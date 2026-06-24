/**
 * Cursed Hearts - RPG Sidebar HUD for Google Docs
 * Version 5.0 - CUSTOM CURRENCIES & COMPACT UI
 */

// ==================== MENU & SIDEBAR ====================

function onOpen() {
  DocumentApp.getUi()
    .createMenu('Cursed Hearts HUD')
    .addItem('Открыть HUD', 'showSidebar')
    .addToUi();
}

function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('⚔️ Cursed Hearts HUD')
    .setWidth(340);
  DocumentApp.getUi().showSidebar(html);
}

// ==================== PROFILE MANAGEMENT ====================

function getAllProfiles() {
  const props = PropertiesService.getUserProperties();
  const profilesJson = props.getProperty('profiles');
  const activeId = props.getProperty('activeProfileId');
  let profiles = {};
  if (profilesJson) { try { profiles = JSON.parse(profilesJson); } catch (e) {} }
  return { profiles: profiles, activeProfileId: activeId || null };
}

function getProfileList() {
  const data = getAllProfiles();
  const list = [];
  for (const id in data.profiles) {
    list.push({ id: id, name: data.profiles[id].profileName || 'Безымянный', isActive: id === data.activeProfileId });
  }
  return list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function getActiveProfile() {
  const data = getAllProfiles();
  return (data.activeProfileId && data.profiles[data.activeProfileId]) ? data.profiles[data.activeProfileId] : getDefaultProfile();
}

function getDefaultProfile() {
  return {
    profileName: '', characterHeader: '', shortName: '',
    armorSlashing: 0, armorPiercing: 0, armorBludgeoning: 0, armorChopping: 0,
    armorMagicBase: 0, armorMagicOverrides: '', armorUndead: 0, multipliers: '',
    spellList: '', resourceName: 'Ресурс', resourceMax: 10,
    customCurrencies: '' // НОВОЕ: "Души:souls:💀, Эссенция:essence:✨"
  };
}

function setActiveProfile(profileId) {
  const props = PropertiesService.getUserProperties();
  const data = getAllProfiles();
  if (data.profiles[profileId]) { props.setProperty('activeProfileId', profileId); return { success: true, message: 'Профиль активирован!' }; }
  return { success: false, message: 'Профиль не найден!' };
}

function saveProfile(profile, profileId) {
  const props = PropertiesService.getUserProperties();
  const data = getAllProfiles();
  if (!profileId) profileId = 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  if (!profile.profileName || !profile.profileName.trim()) return { success: false, message: 'Введите имя профиля!' };
  if (!profile.characterHeader || !profile.characterHeader.trim()) return { success: false, message: 'Введите заголовок персонажа!' };
  
  data.profiles[profileId] = {
    profileName: profile.profileName.trim(), characterHeader: profile.characterHeader.trim(),
    shortName: (profile.shortName || profile.profileName).trim(),
    armorSlashing: +profile.armorSlashing || 0, armorPiercing: +profile.armorPiercing || 0,
    armorBludgeoning: +profile.armorBludgeoning || 0, armorChopping: +profile.armorChopping || 0,
    armorMagicBase: +profile.armorMagicBase || 0, armorMagicOverrides: profile.armorMagicOverrides || '',
    armorUndead: +profile.armorUndead || 0, multipliers: profile.multipliers || '',
    spellList: profile.spellList || '', resourceName: profile.resourceName || 'Ресурс',
    resourceMax: +profile.resourceMax || 10,
    customCurrencies: profile.customCurrencies || ''
  };
  
  props.setProperty('profiles', JSON.stringify(data.profiles));
  if (!data.activeProfileId) props.setProperty('activeProfileId', profileId);
  return { success: true, message: 'Профиль сохранён!', profileId: profileId };
}

function deleteProfile(profileId) {
  const props = PropertiesService.getUserProperties();
  const data = getAllProfiles();
  if (!data.profiles[profileId]) return { success: false, message: 'Профиль не найден!' };
  const name = data.profiles[profileId].profileName;
  delete data.profiles[profileId];
  props.setProperty('profiles', JSON.stringify(data.profiles));
  if (data.activeProfileId === profileId) {
    const ids = Object.keys(data.profiles);
    ids.length ? props.setProperty('activeProfileId', ids[0]) : props.deleteProperty('activeProfileId');
  }
  return { success: true, message: 'Профиль "' + name + '" удалён!' };
}

function getProfileById(profileId) { return getAllProfiles().profiles[profileId] || null; }

// ==================== DOCUMENT SEARCH (CACHED) ====================

var _cachedBody = null;
var _cachedSettings = null;

function getContext() {
  if (_cachedBody && _cachedSettings) return { body: _cachedBody, settings: _cachedSettings };
  
  const settings = getActiveProfile();
  if (!settings.characterHeader) throw new Error('Заголовок не задан!');
  
  const doc = DocumentApp.getActiveDocument();
  const pattern = settings.characterHeader.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  try {
    const tabs = doc.getTabs();
    for (let i = 0; i < tabs.length; i++) {
      const result = searchTab(tabs[i], pattern);
      if (result) { _cachedBody = result; _cachedSettings = settings; return { body: result, settings: settings }; }
    }
  } catch (e) {}
  
  const body = doc.getBody();
  if (body.findText(pattern)) { _cachedBody = body; _cachedSettings = settings; return { body: body, settings: settings }; }
  
  throw new Error('Персонаж не найден!');
}

function searchTab(tab, pattern) {
  const body = tab.asDocumentTab().getBody();
  if (body.findText(pattern)) return body;
  const children = tab.getChildTabs();
  for (let i = 0; i < children.length; i++) {
    const result = searchTab(children[i], pattern);
    if (result) return result;
  }
  return null;
}

function clearCache() { _cachedBody = null; _cachedSettings = null; }

function getSelectedText() {
  const doc = DocumentApp.getActiveDocument();
  const selection = doc.getSelection();
  if (!selection) return { success: false, message: 'Выделите текст!' };
  let text = '';
  selection.getRangeElements().forEach(e => {
    const el = e.getElement();
    if (el.editAsText) {
      const s = e.getStartOffset(), end = e.getEndOffsetInclusive();
      text += (s >= 0 && end >= 0) ? el.editAsText().getText().substring(s, end + 1) : el.editAsText().getText();
    }
  });
  return { success: true, text: text.trim() };
}

// ==================== HELPERS ====================

function parseKV(str) {
  const r = {};
  if (!str) return r;
  str.split(',').forEach(p => {
    const i = p.indexOf(':');
    if (i > 0) { const k = p.substring(0, i).trim().toLowerCase(), v = parseFloat(p.substring(i + 1)); if (k && !isNaN(v)) r[k] = v; }
  });
  return r;
}

const SUBTYPE_NAMES = {
  slashing:'Режущий',piercing:'Колющий',bludgeoning:'Дробящий',chopping:'Рубящий',
  fire:'Огонь',water:'Вода',earth:'Земля',air:'Воздух',light:'Свет',space:'Пространство',
  astral:'Астрал',corruption:'Скверна',electricity:'Электричество',darkness:'Тьма',
  void:'Пустота',life:'Жизнь',blood:'Кровь',frost:'Мороз',death:'Смерть',
  nature:'Природа',transcendence:'Запредельность',pure:'Чистый'
};

function getSubtypeName(s) { return SUBTYPE_NAMES[s] || s; }

function getArmor(settings, cat, sub) {
  if (cat === 'pure') return 0;
  if (cat === 'physical') {
    return { slashing: settings.armorSlashing, piercing: settings.armorPiercing, bludgeoning: settings.armorBludgeoning, chopping: settings.armorChopping }[sub] || 0;
  }
  const ov = parseKV(settings.armorMagicOverrides);
  const name = getSubtypeName(sub).toLowerCase();
  return ov[name] ?? ov[sub] ?? settings.armorMagicBase ?? 0;
}

function getMult(settings, sub) {
  const m = parseKV(settings.multipliers);
  return m[getSubtypeName(sub).toLowerCase()] ?? m[sub] ?? 1.0;
}

// ==================== STAT OPERATIONS ====================

function updateStat(body, name, newCur, newMax) {
  const pattern = name + ':\\s*(-?\\d+)\\s*/\\s*(\\d+)';
  const search = body.findText(pattern);
  if (!search) throw new Error(name + ' не найдена!');
  
  const el = search.getElement().asText();
  const s = search.getStartOffset(), e = search.getEndOffsetInclusive();
  const m = el.getText().substring(s, e + 1).match(new RegExp(pattern));
  
  const cur = newCur ?? +m[1], max = newMax ?? +m[2];
  const txt = name + ': ' + cur + '/' + max;
  
  const styles = { ff: el.getFontFamily(s), fs: el.getFontSize(s), fc: el.getForegroundColor(s), bg: el.getBackgroundColor(s), b: el.isBold(s), i: el.isItalic(s) };
  
  el.deleteText(s, e);
  el.insertText(s, txt);
  
  const ne = s + txt.length - 1;
  if (styles.ff) el.setFontFamily(s, ne, styles.ff);
  if (styles.fs) el.setFontSize(s, ne, styles.fs);
  if (styles.fc) el.setForegroundColor(s, ne, styles.fc);
  if (styles.bg) el.setBackgroundColor(s, ne, styles.bg);
  if (styles.b !== null) el.setBold(s, ne, styles.b);
  if (styles.i !== null) el.setItalic(s, ne, styles.i);
  
  return { current: cur, max: max };
}

function getStat(body, name) {
  const pattern = name + ':\\s*(-?\\d+)\\s*/\\s*(\\d+)';
  const search = body.findText(pattern);
  if (!search) throw new Error(name + ' не найдена!');
  const m = search.getElement().asText().getText().substring(search.getStartOffset(), search.getEndOffsetInclusive() + 1).match(new RegExp(pattern));
  return { current: +m[1], max: +m[2] };
}

// ==================== COMBAT ====================

function takeDamage(rawDamage, category, subtype, isUndead) {
  const ctx = getContext();
  const { body, settings } = ctx;
  
  let finalDamage, armorValue = 0, multiplier = 1, undeadBonus = 0;
  
  if (category === 'pure') {
    finalDamage = rawDamage;
  } else {
    armorValue = getArmor(settings, category, subtype);
    multiplier = getMult(settings, subtype);
    undeadBonus = isUndead ? (settings.armorUndead || 0) : 0;
    finalDamage = Math.max(0, Math.round((rawDamage * multiplier) - armorValue - undeadBonus));
  }
  
  const hp = getStat(body, 'Здоровье');
  const newHp = hp.current - finalDamage;
  updateStat(body, 'Здоровье', newHp, null);
  
  const shortName = settings.shortName || settings.profileName || 'Персонаж';
  const logText = category === 'pure' 
    ? 'получил ' + finalDamage + ' чистого урона → ' + newHp + '/' + hp.max
    : 'получил ' + finalDamage + ' урона (' + getSubtypeName(subtype) + (isUndead ? ', нежить' : '') + ') → ' + newHp + '/' + hp.max;
  quickLog(body, shortName, logText);
  
  return { success: true, rawDamage, finalDamage, armorValue, multiplier, undeadBonus, newHealth: newHp, maxHealth: hp.max, isPure: category === 'pure' };
}

function healHealth(amount) {
  const ctx = getContext();
  const hp = getStat(ctx.body, 'Здоровье');
  const newHp = Math.min(hp.max, hp.current + amount);
  updateStat(ctx.body, 'Здоровье', newHp, null);
  quickLog(ctx.body, ctx.settings.shortName || 'Персонаж', 'восстановил ' + amount + ' ОЗ → ' + newHp + '/' + hp.max);
  return { success: true, current: newHp, max: hp.max };
}

// ==================== MANA ====================

function spendMana(amount) {
  const ctx = getContext();
  const mana = getStat(ctx.body, 'Мана');
  const newMana = Math.max(0, mana.current - amount);
  updateStat(ctx.body, 'Мана', newMana, null);
  quickLog(ctx.body, ctx.settings.shortName || 'Персонаж', 'потратил ' + amount + ' маны → ' + newMana + '/' + mana.max);
  return { success: true, current: newMana, max: mana.max };
}

function restoreMana(amount) {
  const ctx = getContext();
  const mana = getStat(ctx.body, 'Мана');
  const newMana = Math.min(mana.max, mana.current + amount);
  updateStat(ctx.body, 'Мана', newMana, null);
  quickLog(ctx.body, ctx.settings.shortName || 'Персонаж', 'восстановил ' + amount + ' маны → ' + newMana + '/' + mana.max);
  return { success: true, current: newMana, max: mana.max };
}

function castSpell(spellName, spellCost) {
  const ctx = getContext();
  const mana = getStat(ctx.body, 'Мана');
  if (mana.current < spellCost) throw new Error('Мало маны! Нужно ' + spellCost + ', есть ' + mana.current);
  const newMana = mana.current - spellCost;
  updateStat(ctx.body, 'Мана', newMana, null);
  quickLog(ctx.body, ctx.settings.shortName || 'Персонаж', 'использовал «' + spellName + '» (-' + spellCost + ') → ' + newMana + '/' + mana.max);
  return { success: true, current: newMana, max: mana.max, spellName };
}

// ==================== CURRENCY (EXTENDED) ====================

function getSimpleCurrency(body, name) {
  const pattern = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\s*(\\d+)';
  const s = body.findText(pattern);
  if (!s) return 0;
  const m = s.getElement().asText().getText().substring(s.getStartOffset(), s.getEndOffsetInclusive() + 1).match(new RegExp(pattern));
  return m ? +m[1] : 0;
}

function setSimpleCurrency(body, name, val) {
  const pattern = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\s*(\\d+)';
  const search = body.findText(pattern);
  if (!search) return false;
  
  const el = search.getElement().asText();
  const s = search.getStartOffset(), e = search.getEndOffsetInclusive();
  const styles = { ff: el.getFontFamily(s), fs: el.getFontSize(s), fc: el.getForegroundColor(s), bg: el.getBackgroundColor(s), b: el.isBold(s), i: el.isItalic(s) };
  
  const txt = name + ': ' + val;
  el.deleteText(s, e);
  el.insertText(s, txt);
  
  const ne = s + txt.length - 1;
  if (styles.ff) el.setFontFamily(s, ne, styles.ff);
  if (styles.fs) el.setFontSize(s, ne, styles.fs);
  if (styles.fc) el.setForegroundColor(s, ne, styles.fc);
  if (styles.bg) el.setBackgroundColor(s, ne, styles.bg);
  if (styles.b !== null) el.setBold(s, ne, styles.b);
  if (styles.i !== null) el.setItalic(s, ne, styles.i);
  return true;
}

function getAllCurrencies(body) {
  return {
    gold: getSimpleCurrency(body, 'Золото'),
    silver: getSimpleCurrency(body, 'Серебро'),
    copper: getSimpleCurrency(body, 'Медяки')
  };
}

function setAllCurrencies(body, gold, silver, copper) {
  setSimpleCurrency(body, 'Золото', gold);
  setSimpleCurrency(body, 'Серебро', silver);
  setSimpleCurrency(body, 'Медяки', copper);
}

// Парсинг кастомных валют из профиля: "Души:souls:💀, Эссенция:essence:✨"
function parseCustomCurrencies(str) {
  const result = [];
  if (!str) return result;
  str.split(',').forEach(part => {
    const pieces = part.trim().split(':');
    if (pieces.length >= 2) {
      result.push({
        displayName: pieces[0].trim(),
        key: pieces[1].trim(),
        icon: pieces[2] ? pieces[2].trim() : '💎'
      });
    }
  });
  return result;
}

function getCustomCurrencyValue(body, displayName) {
  return getSimpleCurrency(body, displayName);
}

function setCustomCurrencyValue(body, displayName, value) {
  return setSimpleCurrency(body, displayName, value);
}

function toCopper(type, amount) {
  return type === 'gold' ? amount * 10000 : type === 'silver' ? amount * 100 : amount;
}

function fromCopper(total) {
  const gold = Math.floor(total / 10000);
  const silver = Math.floor((total % 10000) / 100);
  const copper = total % 100;
  return { gold, silver, copper };
}

function formatMoney(g, s, c) {
  const p = [];
  if (g > 0) p.push(g + 'з');
  if (s > 0) p.push(s + 'с');
  if (c > 0 || p.length === 0) p.push(c + 'м');
  return p.join(' ');
}

const CURRENCY_NAMES = { gold: 'золота', silver: 'серебра', copper: 'медяков' };

function addCurrency(currencyType, amount) {
  const ctx = getContext();
  const cur = getAllCurrencies(ctx.body);
  let total = cur.gold * 10000 + cur.silver * 100 + cur.copper + toCopper(currencyType, amount);
  const opt = fromCopper(total);
  setAllCurrencies(ctx.body, opt.gold, opt.silver, opt.copper);
  quickLog(ctx.body, ctx.settings.shortName || 'Персонаж', 'получил ' + amount + ' ' + CURRENCY_NAMES[currencyType] + ' → ' + formatMoney(opt.gold, opt.silver, opt.copper));
  return { success: true, ...opt, message: '+' + amount + ' ' + CURRENCY_NAMES[currencyType] };
}

function spendCurrency(currencyType, amount) {
  const ctx = getContext();
  const cur = getAllCurrencies(ctx.body);
  let total = cur.gold * 10000 + cur.silver * 100 + cur.copper;
  const cost = toCopper(currencyType, amount);
  
  if (total < cost) {
    const have = fromCopper(total), need = fromCopper(cost);
    throw new Error('Мало денег! Есть: ' + formatMoney(have.gold, have.silver, have.copper) + ', нужно: ' + formatMoney(need.gold, need.silver, need.copper));
  }
  
  const opt = fromCopper(total - cost);
  setAllCurrencies(ctx.body, opt.gold, opt.silver, opt.copper);
  quickLog(ctx.body, ctx.settings.shortName || 'Персонаж', 'потратил ' + amount + ' ' + CURRENCY_NAMES[currencyType] + ' → ' + formatMoney(opt.gold, opt.silver, opt.copper));
  return { success: true, ...opt, message: '-' + amount + ' ' + CURRENCY_NAMES[currencyType] };
}

// Кастомная валюта: добавить/потратить
function modifyCustomCurrency(currencyDisplayName, amount) {
  const ctx = getContext();
  const current = getCustomCurrencyValue(ctx.body, currencyDisplayName);
  const newVal = Math.max(0, current + amount);
  
  if (!setCustomCurrencyValue(ctx.body, currencyDisplayName, newVal)) {
    throw new Error('Валюта "' + currencyDisplayName + '" не найдена в документе!');
  }
  
  const action = amount > 0 ? 'получил ' + amount : 'потратил ' + Math.abs(amount);
  quickLog(ctx.body, ctx.settings.shortName || 'Персонаж', action + ' ' + currencyDisplayName.toLowerCase() + ' → ' + newVal);
  return { success: true, value: newVal, displayName: currencyDisplayName };
}

// ==================== RESOURCE ====================

function modifyResource(delta) {
  const ctx = getContext();
  const name = ctx.settings.resourceName || 'Ресурс';
  const pattern = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\[(\\d+)\\]\\s*/\\s*(\\d+)';
  const search = ctx.body.findText(pattern);
  if (!search) throw new Error('Ресурс не найден! Формат: ' + name + ' [X]/Y');
  
  const el = search.getElement().asText();
  const s = search.getStartOffset(), e = search.getEndOffsetInclusive();
  const m = el.getText().substring(s, e + 1).match(new RegExp(pattern));
  
  const cur = +m[1], max = +m[2];
  const newVal = delta === 'reset' ? max : Math.max(0, Math.min(max, cur + delta));
  
  const styles = { ff: el.getFontFamily(s), fs: el.getFontSize(s), fc: el.getForegroundColor(s), bg: el.getBackgroundColor(s), b: el.isBold(s), i: el.isItalic(s) };
  const txt = name + ' [' + newVal + ']/' + max;
  el.deleteText(s, e);
  el.insertText(s, txt);
  const ne = s + txt.length - 1;
  if (styles.ff) el.setFontFamily(s, ne, styles.ff);
  if (styles.fs) el.setFontSize(s, ne, styles.fs);
  if (styles.fc) el.setForegroundColor(s, ne, styles.fc);
  if (styles.bg) el.setBackgroundColor(s, ne, styles.bg);
  if (styles.b !== null) el.setBold(s, ne, styles.b);
  if (styles.i !== null) el.setItalic(s, ne, styles.i);
  
  const act = delta === 'reset' ? 'восстановил все' : (delta > 0 ? 'получил ' + delta : 'потратил ' + Math.abs(delta));
  quickLog(ctx.body, ctx.settings.shortName || 'Персонаж', act + ' ' + name.toLowerCase() + ' → ' + newVal + '/' + max);
  
  return { success: true, current: newVal, max };
}

function spendResource(n) { return modifyResource(-n); }
function resetResource() { return modifyResource('reset'); }
function addResource(n) { return modifyResource(n); }

// ==================== LOGGING ====================

function quickLog(body, shortName, action) {
  const search = body.findText('Логи:');
  if (!search) return;
  const idx = body.getChildIndex(search.getElement().getParent());
  const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
  const p = body.insertParagraph(idx + 1, '[' + ts + '] ' + shortName + ' ' + action);
  p.setForegroundColor('#808080').setFontSize(9).setItalic(true);
}

// ==================== SIDEBAR STATS ====================

function getSidebarStats() {
  try {
    const ctx = getContext();
    const { body, settings } = ctx;
    
    let health = { current: 0, max: 0 }, mana = { current: 0, max: 0 };
    try { health = getStat(body, 'Здоровье'); } catch (e) {}
    try { mana = getStat(body, 'Мана'); } catch (e) {}
    
    const currencies = getAllCurrencies(body);
    
    // Кастомные валюты
    const customCurrenciesDef = parseCustomCurrencies(settings.customCurrencies);
    const customCurrencies = customCurrenciesDef.map(cc => ({
      ...cc,
      value: getCustomCurrencyValue(body, cc.displayName)
    }));
    
    // Resource
    let resource = { current: 0, max: 0 };
    try {
      const rn = settings.resourceName || 'Ресурс';
      const rp = rn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\[(\\d+)\\]\\s*/\\s*(\\d+)';
      const rs = body.findText(rp);
      if (rs) {
        const rm = rs.getElement().asText().getText().substring(rs.getStartOffset(), rs.getEndOffsetInclusive() + 1).match(new RegExp(rp));
        if (rm) resource = { current: +rm[1], max: +rm[2] };
      }
    } catch (e) {}
    
    return {
      success: true, health, mana,
      currencies, customCurrencies, resource,
      resourceName: settings.resourceName || 'Ресурс',
      characterName: settings.shortName || settings.profileName || 'Персонаж'
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ==================== LONG REST ====================

function performLongRest() {
  const ctx = getContext();
  let health = { current: 0, max: 0 }, mana = { current: 0, max: 0 };
  
  try {
    const hp = getStat(ctx.body, 'Здоровье');
    updateStat(ctx.body, 'Здоровье', hp.max, null);
    health = { current: hp.max, max: hp.max };
  } catch (e) {}
  
  try {
    const mp = getStat(ctx.body, 'Мана');
    updateStat(ctx.body, 'Мана', mp.max, null);
    mana = { current: mp.max, max: mp.max };
  } catch (e) {}
  
  quickLog(ctx.body, ctx.settings.shortName || 'Персонаж', 'совершил долгий отдых');
  
  return { success: true, health, mana, message: 'Отдых завершён!' };
}

function getCurrentStats() {
  try {
    const ctx = getContext();
    return { success: true, health: getStat(ctx.body, 'Здоровье'), mana: getStat(ctx.body, 'Мана') };
  } catch (e) { return { success: false, error: e.message }; }
}