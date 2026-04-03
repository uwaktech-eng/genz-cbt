const SPREADSHEET_ID = 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE';

function doGet(e) {
  return handleRequest_(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  return handleRequest_(params);
}

function handleRequest_(params) {
  try {
    ensureSheets_();

    const action = (params.action || '').trim();
    const payload = parsePayload_(params.payload);
    let result;

    switch (action) {
      case 'getSettings':
        result = getSettings_();
        break;
      case 'saveSettings':
        result = saveSettings_(payload);
        break;
      case 'addCandidate':
        result = addCandidate_(payload);
        break;
      case 'listCandidates':
        result = listCandidates_();
        break;
      case 'verifyCandidate':
        result = verifyCandidate_(payload);
        break;
      case 'unlockExam':
        result = unlockExam_(payload);
        break;
      case 'addQuestion':
        result = addQuestion_(payload);
        break;
      case 'listQuestions':
        result = listQuestions_();
        break;
      case 'clearQuestions':
        result = clearQuestions_();
        break;
      case 'submitExam':
        result = submitExam_(payload);
        break;
      case 'listResults':
        result = listResults_();
        break;
      case 'clearResults':
        result = clearResults_();
        break;
      default:
        result = response_(false, 'Invalid or missing action.');
    }

    return jsonOutput_(result);
  } catch (error) {
    return jsonOutput_(response_(false, error.message || 'Server error.'));
  }
}

function parsePayload_(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function response_(ok, message, data) {
  return {
    ok: ok,
    message: message || '',
    data: data || null
  };
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getOrCreateSheet_(name) {
  const ss = getSpreadsheet_();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureSheets_() {
  const settings = getOrCreateSheet_('Settings');
  const candidates = getOrCreateSheet_('Candidates');
  const questions = getOrCreateSheet_('Questions');
  const results = getOrCreateSheet_('Results');

  if (settings.getLastRow() === 0) {
    settings.getRange(1, 1, 3, 2).setValues([
      ['Key', 'Value'],
      ['Exam Title', 'CBT Examination'],
      ['Duration Minutes', 20]
    ]);
  }

  if (candidates.getLastRow() === 0) {
    candidates.getRange(1, 1, 1, 2).setValues([['Full Name', 'Reg ID']]);
  }

  if (questions.getLastRow() === 0) {
    questions.getRange(1, 1, 1, 7).setValues([['ID', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer']]);
  }

  if (results.getLastRow() === 0) {
    results.getRange(1, 1, 1, 7).setValues([['Timestamp', 'Full Name', 'Reg ID', 'Score', 'Percentage', 'Passed Question Nos', 'Failed Question Nos']]);
  }
}

function normalize_(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

function getSettingsMap_() {
  const sheet = getOrCreateSheet_('Settings');
  const values = sheet.getDataRange().getValues();
  const map = {};
  for (let i = 1; i < values.length; i++) {
    const key = String(values[i][0] || '').trim();
    const val = values[i][1];
    if (key) map[key] = val;
  }
  return map;
}

function getSettings_() {
  const map = getSettingsMap_();
  return response_(true, 'Settings loaded.', {
    examTitle: map['Exam Title'] || 'CBT Examination',
    durationMinutes: Number(map['Duration Minutes'] || 20)
  });
}

function saveSettings_(payload) {
  const examTitle = String(payload.examTitle || '').trim() || 'CBT Examination';
  const durationMinutes = Number(payload.durationMinutes || 20) || 20;
  const sheet = getOrCreateSheet_('Settings');
  sheet.getRange(2, 1, 2, 2).setValues([
    ['Exam Title', examTitle],
    ['Duration Minutes', durationMinutes]
  ]);
  return response_(true, 'Exam settings saved successfully.', {
    examTitle: examTitle,
    durationMinutes: durationMinutes
  });
}

function getCandidates_() {
  const sheet = getOrCreateSheet_('Candidates');
  const values = sheet.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < values.length; i++) {
    const fullName = String(values[i][0] || '').trim();
    const regId = String(values[i][1] || '').trim();
    if (fullName && regId) {
      list.push({ fullName: fullName, regId: regId, fullNameKey: normalize_(fullName), regIdKey: normalize_(regId) });
    }
  }
  return list;
}

function addCandidate_(payload) {
  const fullName = String(payload.fullName || '').trim();
  const regId = String(payload.regId || '').trim();
  if (!fullName || !regId) {
    return response_(false, 'Full name and Registration ID are required.');
  }

  const existing = getCandidates_().filter(function(item) {
    return item.regIdKey === normalize_(regId);
  });
  if (existing.length) {
    return response_(false, 'This Registration ID already exists in the Candidates sheet.');
  }

  getOrCreateSheet_('Candidates').appendRow([fullName, regId]);
  return response_(true, 'Candidate added successfully.', { fullName: fullName, regId: regId });
}

function listCandidates_() {
  const list = getCandidates_().map(function(item) {
    return { fullName: item.fullName, regId: item.regId };
  });
  return response_(true, 'Candidates loaded.', list);
}

function findCandidateByRegId_(regId) {
  const regIdKey = normalize_(regId);
  const candidates = getCandidates_();
  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i].regIdKey === regIdKey) return candidates[i];
  }
  return null;
}

function getResultRows_() {
  const sheet = getOrCreateSheet_('Results');
  const values = sheet.getDataRange().getValues();
  const headers = values[0] || [];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    if (!values[i].join('').trim()) continue;
    rows.push(values[i]);
  }
  return { headers: headers, rows: rows };
}

function hasTakenExam_(regId) {
  const data = getResultRows_();
  const regIdKey = normalize_(regId);
  for (let i = 0; i < data.rows.length; i++) {
    if (normalize_(data.rows[i][2]) === regIdKey) return true;
  }
  return false;
}

function verifyCandidate_(payload) {
  const fullName = String(payload.fullName || '').trim();
  const regId = String(payload.regId || '').trim();
  if (!fullName || !regId) {
    return response_(false, 'Full name and Registration ID are required.');
  }

  const candidate = findCandidateByRegId_(regId);
  if (!candidate) {
    return response_(false, 'Registration ID not found in the Candidates sheet.');
  }
  if (candidate.fullNameKey !== normalize_(fullName)) {
    return response_(false, 'The full name does not match the Registration ID in the Candidates sheet.');
  }
  if (hasTakenExam_(regId)) {
    return response_(false, 'This Registration ID has already been used to submit the exam.');
  }

  const settings = getSettingsMap_();
  return response_(true, 'Candidate verified successfully.', {
    fullName: candidate.fullName,
    regId: candidate.regId,
    examTitle: settings['Exam Title'] || 'CBT Examination'
  });
}

function getQuestionsRaw_() {
  const sheet = getOrCreateSheet_('Questions');
  const values = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const id = String(values[i][0] || '').trim();
    const question = String(values[i][1] || '').trim();
    if (!id || !question) continue;
    rows.push({
      id: id,
      question: question,
      optionA: String(values[i][2] || '').trim(),
      optionB: String(values[i][3] || '').trim(),
      optionC: String(values[i][4] || '').trim(),
      optionD: String(values[i][5] || '').trim(),
      answer: normalize_(values[i][6])
    });
  }
  return rows;
}

function unlockExam_(payload) {
  const regId = String(payload.regId || '').trim();
  if (!regId) return response_(false, 'Registration ID is required.');

  const candidate = findCandidateByRegId_(regId);
  if (!candidate) return response_(false, 'Registration ID not found in the Candidates sheet.');
  if (hasTakenExam_(regId)) return response_(false, 'This Registration ID has already submitted the exam.');

  const questions = getQuestionsRaw_();
  if (!questions.length) return response_(false, 'No questions have been added yet.');

  const publicQuestions = questions.map(function(q) {
    return {
      id: q.id,
      question: q.question,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD
    };
  });

  const settings = getSettingsMap_();
  return response_(true, 'Exam unlocked successfully.', {
    examTitle: settings['Exam Title'] || 'CBT Examination',
    durationMinutes: Number(settings['Duration Minutes'] || 20),
    questions: publicQuestions
  });
}

function addQuestion_(payload) {
  const question = String(payload.question || '').trim();
  const optionA = String(payload.optionA || '').trim();
  const optionB = String(payload.optionB || '').trim();
  const optionC = String(payload.optionC || '').trim();
  const optionD = String(payload.optionD || '').trim();
  const answer = normalize_(payload.answer);

  if (!question || !optionA || !optionB || !optionC || !optionD || !answer) {
    return response_(false, 'Fill the question, all four options, and the correct answer.');
  }
  if (['A', 'B', 'C', 'D'].indexOf(answer) === -1) {
    return response_(false, 'Correct answer must be A, B, C, or D.');
  }

  const id = 'Q' + new Date().getTime();
  getOrCreateSheet_('Questions').appendRow([id, question, optionA, optionB, optionC, optionD, answer]);
  return response_(true, 'Question added successfully.', { id: id });
}

function listQuestions_() {
  const list = getQuestionsRaw_();
  return response_(true, 'Questions loaded.', list);
}

function clearQuestions_() {
  const sheet = getOrCreateSheet_('Questions');
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 7).setValues([['ID', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer']]);
  return response_(true, 'All questions deleted successfully.');
}

function ensureResultsHeaderForQuestions_(questionCount) {
  const sheet = getOrCreateSheet_('Results');
  const headers = ['Timestamp', 'Full Name', 'Reg ID', 'Score', 'Percentage', 'Passed Question Nos', 'Failed Question Nos'];
  for (var i = 1; i <= questionCount; i++) {
    headers.push('Q' + i + ' Detail');
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return headers;
}

function submitExam_(payload) {
  const fullName = String(payload.fullName || '').trim();
  const regId = String(payload.regId || '').trim();
  const answers = payload.answers || [];

  if (!fullName || !regId) {
    return response_(false, 'Full name and Registration ID are required for submission.');
  }

  const candidate = findCandidateByRegId_(regId);
  if (!candidate) {
    return response_(false, 'Registration ID not found in the Candidates sheet.');
  }
  if (candidate.fullNameKey !== normalize_(fullName)) {
    return response_(false, 'Full name does not match the registered candidate.');
  }
  if (hasTakenExam_(regId)) {
    return response_(false, 'This Registration ID has already submitted the exam.');
  }

  const questions = getQuestionsRaw_();
  if (!questions.length) {
    return response_(false, 'No exam questions available.');
  }

  const answerMap = {};
  for (var a = 0; a < answers.length; a++) {
    answerMap[String(answers[a].questionId || '')] = normalize_(answers[a].selected || '');
  }

  var score = 0;
  var passedNos = [];
  var failedNos = [];
  var details = [];

  for (var i = 0; i < questions.length; i++) {
    var q = questions[i];
    var chosen = answerMap[q.id] || 'BLANK';
    var correct = q.answer;
    var qNo = i + 1;
    if (chosen === correct) {
      score++;
      passedNos.push(qNo);
      details.push('PASS | Your: ' + chosen + ' | Correct: ' + correct);
    } else {
      failedNos.push(qNo);
      details.push('FAIL | Your: ' + chosen + ' | Correct: ' + correct);
    }
  }

  var total = questions.length;
  var percentage = ((score / total) * 100).toFixed(2);
  ensureResultsHeaderForQuestions_(questions.length);

  var row = [
    new Date(),
    candidate.fullName,
    candidate.regId,
    score + '/' + total,
    percentage,
    passedNos.join(', '),
    failedNos.join(', ')
  ].concat(details);

  getOrCreateSheet_('Results').appendRow(row);

  return response_(true, 'Exam submitted successfully.', {
    fullName: candidate.fullName,
    regId: candidate.regId,
    score: score,
    total: total,
    percentage: percentage,
    passedNos: passedNos.join(', '),
    failedNos: failedNos.join(', ')
  });
}

function listResults_() {
  const data = getResultRows_();
  const out = data.rows.map(function(row) {
    return {
      timestamp: row[0] instanceof Date ? Utilities.formatDate(row[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') : row[0],
      fullName: row[1] || '',
      regId: row[2] || '',
      score: row[3] || '',
      percentage: row[4] || ''
    };
  });
  return response_(true, 'Results loaded.', out);
}

function clearResults_() {
  const sheet = getOrCreateSheet_('Results');
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 7).setValues([['Timestamp', 'Full Name', 'Reg ID', 'Score', 'Percentage', 'Passed Question Nos', 'Failed Question Nos']]);
  return response_(true, 'All results cleared successfully.');
}
