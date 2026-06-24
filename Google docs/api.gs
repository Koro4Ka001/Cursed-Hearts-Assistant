// ==================== MAIN ENDPOINTS ====================

function doGet(e) {
  try {
    const action = e.parameter.action;
    const characterHeader = e.parameter.character;

    Logger.log('doGet called: action=' + action + ', character=' + characterHeader);

    if (action === 'ping') {
      return jsonResponse({ success: true, message: 'Pong' });
    }

    if (!characterHeader) {
      return jsonResponse({ success: false, error: 'No character header provided' });
    }

    const ctx = findCharacterContext(characterHeader);

    switch (action) {
      case 'stats':
        return jsonResponse(getStatsPure(ctx));
      default:
        return jsonResponse({ success: false, error: 'Unknown GET action' });
    }
  } catch (err) {
    Logger.log('doGet error: ' + err.toString());
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    return jsonResponse({ success: false, error: 'Server busy, try again' });
  }
  
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const characterHeader = data.character;

    Logger.log('doPost called: action=' + action + ', character=' + characterHeader);

    if (!characterHeader) {
      return jsonResponse({ success: false, error: 'No character header provided' });
    }

    const ctx = findCharacterContext(characterHeader);

    switch (action) {
      case 'setHealth':
        return jsonResponse(updateStatPure(ctx, 'Здоровье', data.current, data.max));
      
      case 'setMana':
        return jsonResponse(updateStatPure(ctx, 'Мана', data.current, data.max));
      
      case 'setRage':
        Logger.log('setRage called: ' + data.current + '/' + data.max);
        return jsonResponse(updateStatPure(ctx, 'RAGE', data.current, data.max));
      
      case 'setResource':
        return jsonResponse(setResourcePure(ctx, data.name, data.current));

      case 'spendMana':
        var mana = getStatPure(ctx, 'Мана');
        var newMana = Math.max(0, mana.current - data.amount);
        updateStatPure(ctx, 'Мана', newMana, mana.max);
        logPure(ctx, 'потратил ' + data.amount + ' маны');
        return jsonResponse({ success: true, current: newMana });

      case 'restoreMana':
        var rMana = getStatPure(ctx, 'Мана');
        var resMana = Math.min(rMana.max, rMana.current + data.amount);
        updateStatPure(ctx, 'Мана', resMana, rMana.max);
        logPure(ctx, 'восстановил ' + data.amount + ' маны');
        return jsonResponse({ success: true, current: resMana });

      case 'heal':
        var hp = getStatPure(ctx, 'Здоровье');
        var newHp = Math.min(hp.max, hp.current + data.amount);
        updateStatPure(ctx, 'Здоровье', newHp, hp.max);
        logPure(ctx, 'исцелился на ' + data.amount);
        return jsonResponse({ success: true, current: newHp });

      case 'log':
        logPure(ctx, data.message);
        return jsonResponse({ success: true });

      default:
        return jsonResponse({ success: false, error: 'Unknown POST action: ' + action });
    }
  } catch (err) {
    Logger.log('doPost error: ' + err.toString());
    return jsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// ==================== CORE SEARCH LOGIC ====================

function findCharacterContext(header) {
  var doc = DocumentApp.getActiveDocument();
  var pattern = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  Logger.log('Searching for character: ' + header);

  try {
    var tabs = doc.getTabs();
    for (var i = 0; i < tabs.length; i++) {
      var foundBody = recursiveSearch(tabs[i], pattern);
      if (foundBody) {
        Logger.log('Found character in tab: ' + header);
        return { body: foundBody, name: header };
      }
    }
  } catch (e) {
    Logger.log('Error searching tabs: ' + e.toString());
  }

  var mainBody = doc.getBody();
  if (mainBody.findText(pattern)) {
    Logger.log('Found character in main body: ' + header);
    return { body: mainBody, name: header };
  }

  throw new Error('Персонаж с заголовком "' + header + '" не найден ни в одной вкладке.');
}

function recursiveSearch(tab, pattern) {
  var tabBody = tab.asDocumentTab().getBody();
  if (tabBody.findText(pattern)) {
    return tabBody;
  }

  var children = tab.getChildTabs();
  for (var i = 0; i < children.length; i++) {
    var found = recursiveSearch(children[i], pattern);
    if (found) return found;
  }
  return null;
}

// ==================== PURE LOGIC ====================

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function getStatPure(ctx, statName) {
  var pattern = statName + ':\\s*(?:\\[)?(\\d+)(?:\\])?\\s*\\/\\s*(\\d+)';
  var range = ctx.body.findText(pattern);
  
  if (!range) {
    Logger.log('Stat not found: ' + statName);
    return { current: 0, max: 0, error: 'Stat not found' };
  }

  var text = range.getElement().asText().getText().substring(range.getStartOffset(), range.getEndOffsetInclusive() + 1);
  var match = text.match(new RegExp(pattern));
  
  if (match) {
    Logger.log('Found ' + statName + ': ' + match[1] + '/' + match[2]);
    return { current: parseInt(match[1]), max: parseInt(match[2]) };
  }
  return { current: 0, max: 0 };
}

function getStatsPure(ctx) {
  Logger.log('Getting stats for: ' + ctx.name);
  
  var hp = getStatPure(ctx, 'Здоровье');
  var mana = getStatPure(ctx, 'Мана');
  var rage = getStatPure(ctx, 'RAGE');
  
  Logger.log('HP: ' + hp.current + '/' + hp.max);
  Logger.log('Mana: ' + mana.current + '/' + mana.max);
  Logger.log('RAGE: ' + rage.current + '/' + rage.max);
  
  var resources = {};
  var text = ctx.body.getText();
  var resRegex = /([^\n\r:]+?)(?::\s*|\s+)\[(\d+)\]\s*\/\s*(\d+)/g;
  var match;
  while ((match = resRegex.exec(text)) !== null) {
    var name = match[1].trim();
    if (name !== 'Здоровье' && name !== 'Мана' && name !== 'RAGE') {
      resources[name] = { current: parseInt(match[2]), max: parseInt(match[3]) };
    }
  }

  var result = {
    success: true,
    health: hp,
    mana: mana,
    rage: rage,
    resources: resources
  };
  
  Logger.log('Returning stats: ' + JSON.stringify(result));
  return result;
}

function updateStatPure(ctx, statName, newVal, maxVal) {
  var pattern = statName + ':\\s*(?:\\[)?(-?\\d+)(?:\\])?\\s*\\/\\s*(\\d+)';
  var search = ctx.body.findText(pattern);
  
  if (!search) throw new Error(statName + ' не найден в документе');

  var element = search.getElement().asText();
  var start = search.getStartOffset();
  var end = search.getEndOffsetInclusive();
  
  var text = element.getText().substring(start, end + 1);
  var m = text.match(new RegExp(pattern));
  var currentMax = maxVal != null ? maxVal : (m ? parseInt(m[2]) : 100);
  
  var hasSquareBrackets = text.indexOf('[') >= 0;
  
  var newText = hasSquareBrackets 
    ? statName + ': [' + newVal + ']/' + currentMax
    : statName + ': ' + newVal + '/' + currentMax;

  var styles = {
    fontFamily: element.getFontFamily(start),
    fontSize: element.getFontSize(start),
    foregroundColor: element.getForegroundColor(start),
    backgroundColor: element.getBackgroundColor(start),
    bold: element.isBold(start),
    italic: element.isItalic(start),
    underline: element.isUnderline(start),
    strikethrough: element.isStrikethrough(start)
  };

  element.deleteText(start, end);
  element.insertText(start, newText);
  
  var newEnd = start + newText.length - 1;
  
  if (styles.fontFamily) element.setFontFamily(start, newEnd, styles.fontFamily);
  if (styles.fontSize) element.setFontSize(start, newEnd, styles.fontSize);
  if (styles.foregroundColor) element.setForegroundColor(start, newEnd, styles.foregroundColor);
  if (styles.backgroundColor) element.setBackgroundColor(start, newEnd, styles.backgroundColor);
  if (styles.bold !== null) element.setBold(start, newEnd, styles.bold);
  if (styles.italic !== null) element.setItalic(start, newEnd, styles.italic);
  if (styles.underline !== null) element.setUnderline(start, newEnd, styles.underline);
  if (styles.strikethrough !== null) element.setStrikethrough(start, newEnd, styles.strikethrough);
  
  Logger.log('Updated ' + statName + ' to: ' + newVal + '/' + currentMax);
  return { success: true, current: newVal, max: currentMax };
}

function setResourcePure(ctx, name, val) {
  var escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  var pattern = escaped + '(?::\\s*|\\s+)\\[(\\d+)\\]\\s*\\/\\s*(\\d+)';
  
  var search = ctx.body.findText(pattern);
  if (!search) throw new Error('Ресурс "' + name + '" не найден');

  var el = search.getElement().asText();
  var start = search.getStartOffset();
  var end = search.getEndOffsetInclusive();
  var text = el.getText().substring(start, end + 1);
  var m = text.match(new RegExp(pattern));
  var max = m ? parseInt(m[2]) : 10;
  
  var hasColon = text.indexOf(':') >= 0;
  var newText = hasColon 
    ? name + ': [' + val + ']/' + max
    : name + ' [' + val + ']/' + max;

  var styles = {
    fontFamily: el.getFontFamily(start),
    fontSize: el.getFontSize(start),
    foregroundColor: el.getForegroundColor(start),
    backgroundColor: el.getBackgroundColor(start),
    bold: el.isBold(start),
    italic: el.isItalic(start),
    underline: el.isUnderline(start),
    strikethrough: el.isStrikethrough(start)
  };

  el.deleteText(start, end);
  el.insertText(start, newText);

  var newEnd = start + newText.length - 1;
  
  if (styles.fontFamily) el.setFontFamily(start, newEnd, styles.fontFamily);
  if (styles.fontSize) el.setFontSize(start, newEnd, styles.fontSize);
  if (styles.foregroundColor) el.setForegroundColor(start, newEnd, styles.foregroundColor);
  if (styles.backgroundColor) el.setBackgroundColor(start, newEnd, styles.backgroundColor);
  if (styles.bold !== null) el.setBold(start, newEnd, styles.bold);
  if (styles.italic !== null) el.setItalic(start, newEnd, styles.italic);
  if (styles.underline !== null) el.setUnderline(start, newEnd, styles.underline);
  if (styles.strikethrough !== null) el.setStrikethrough(start, newEnd, styles.strikethrough);

  logPure(ctx, name + ': ' + val + '/' + max);
  return { success: true };
}

function logPure(ctx, message) {
  var search = ctx.body.findText('Логи:');
  if (search) {
    var el = search.getElement();
    var parent = el.getParent();
    var time = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm');
    var logLine = '[' + time + '] ' + ctx.name + ': ' + message;
    
    var p = ctx.body.insertParagraph(parent.getParent().getChildIndex(parent) + 1, logLine);
    p.setForegroundColor('#666666').setFontSize(8).setItalic(true);
  }
}