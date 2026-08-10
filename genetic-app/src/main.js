import { LocalNotifications } from '@capacitor/local-notifications';

let tests = JSON.parse(localStorage.getItem('genetic_tests') || '[]');

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    updateDefaults();
    render();
    
    // יצירת ערוץ התראות לאנדרואיד (חשוב כדי שיעבוד ברקע עם סאונד)
    try {
        await LocalNotifications.createChannel({
            id: 'genetic-reminders',
            name: 'Genetic Tests Reminders',
            description: 'Reminders for genetic tests workflow',
            importance: 5,
            visibility: 1
        });
    } catch(e) { console.log('Channel creation usually fails on web, works on native'); }
});

// ==========================================
// אינטגרציה עם התראות Native של הטלפון!
// ==========================================
async function requestPermissionManual() {
    const res = await LocalNotifications.requestPermissions();
    if (res.display === 'granted') {
        alert("✅ התראות אושרו בהצלחה!");
    } else {
        alert("❌ התראות חסומות. יש לאשר בהגדרות הטלפון.");
    }
}

async function scheduleNativeNotification(title, body, targetTimeISO, id) {
    const targetDate = new Date(targetTimeISO);
    
    await LocalNotifications.schedule({
        notifications: [
            {
                title: title,
                body: body,
                id: id, // מזהה ייחודי מספרי
                schedule: { at: targetDate },
                channelId: 'genetic-reminders',
                smallIcon: 'ic_stat_icon_config_sample'
            }
        ]
    });
    console.log(`התראה תוכנתה בהצלחה ל: ${targetDate.toLocaleString()}`);
}

async function testOneMinuteNotification() {
    const res = await LocalNotifications.checkPermissions();
    if (res.display !== 'granted') {
        alert("חובה לאשר התראות תחילה (כפתור למעלה).");
        return;
    }
    
    alert("✅ טיימר הופעל! גם אם תסגור את האפליקציה לגמרי (תעיף מהמסך), ההתראה תגיע בעוד דקה.");
    
    const targetDate = new Date(Date.now() + 60000); // בעוד דקה
    await scheduleNativeNotification("⏱️ בדיקת מערכת", "מצוין! ההתראה Native עובדת גם כשהאפליקציה סגורה.", targetDate.toISOString(), 999999);
}

// ==========================================
// פונקציונליות האפליקציה 
// ==========================================

function updateDefaults() {
    const type = document.querySelector('input[name="test-type"]:checked').value;
    const resDays = document.getElementById('result-days');
    if (type === 'genome') resDays.value = 17;
    else if (type === 'molecular') resDays.value = 21;
    else resDays.value = 14;
}

function toggleWorkInputs() {
    const enabled = document.getElementById('enable-work-reminder').checked;
    document.getElementById('work-inputs-container').classList.toggle('opacity-40', !enabled);
    document.getElementById('work-inputs-container').querySelectorAll('input').forEach(i => i.disabled = !enabled);
}

function addReminder(e) {
    e.preventDefault();
    const name = document.getElementById('test-name').value;
    const type = document.querySelector('input[name="test-type"]:checked').value;
    const enableWork = document.getElementById('enable-work-reminder').checked;

    // תיקון ה- 0 ימים!
    let parsedWork = parseInt(document.getElementById('work-days').value);
    const workDays = isNaN(parsedWork) ? 1 : parsedWork;
    const workTime = document.getElementById('work-time').value || "09:00";
    
    let parsedResult = parseInt(document.getElementById('result-days').value);
    const resultDays = isNaN(parsedResult) ? 14 : parsedResult;
    const resultTime = document.getElementById('result-time').value || "09:00";

    const now = new Date();
    
    const [wHours, wMinutes] = workTime.split(':');
    const workDate = new Date();
    workDate.setDate(now.getDate() + workDays);
    workDate.setHours(parseInt(wHours), parseInt(wMinutes), 0, 0);

    const [rHours, rMinutes] = resultTime.split(':');
    const resultDate = new Date();
    resultDate.setDate(now.getDate() + resultDays);
    resultDate.setHours(parseInt(rHours), parseInt(rMinutes), 0, 0);

    if (workDate.getTime() < now.getTime()) {
        alert("שים לב! השעה שהגדרת כבר עברה להיום.");
    }

    const testId = Date.now();
    const newTest = {
        id: testId, name, type, createdAt: now.toISOString(),
        hasWorkReminder: enableWork, workStartedDate: workDate.toISOString(),
        resultDate: resultDate.toISOString(), status: enableWork ? 'pending_work' : 'pending_result', delayedCount: 0
    };

    tests.push(newTest);
    saveAndRender();

    // תזמון ההתראה במערכת ההפעלה
    const notificationId = Math.floor(Math.random() * 1000000);
    newTest.notificationId = notificationId; // שמירת מזהה ההתראה כדי שנוכל לבטל בעתיד אם נרצה
    
    if (enableWork) {
        scheduleNativeNotification("תזכורת כניסה לעבודה", `יש להכניס את הבדיקה של ${name} לעבודה`, workDate.toISOString(), notificationId);
    } else {
        scheduleNativeNotification("תזכורת תוצאה", `יש לבדוק תוצאות עבור ${name}`, resultDate.toISOString(), notificationId);
    }

    document.getElementById('add-form').reset();
    updateDefaults();
    switchTab(enableWork ? 'work' : 'results');
}

window.setWorkStatus = function(id, started) {
    tests = tests.map(test => {
        if (test.id === id) {
            if (started) {
                test.status = 'pending_result';
                scheduleNativeNotification("תזכורת תוצאה", `יש לבדוק תוצאות עבור ${test.name}`, test.resultDate, Math.floor(Math.random() * 1000000));
            } else {
                let wDate = new Date(test.workStartedDate); wDate.setDate(wDate.getDate() + 1); test.workStartedDate = wDate.toISOString();
                let rDate = new Date(test.resultDate); rDate.setDate(rDate.getDate() + 1); test.resultDate = rDate.toISOString();
                test.delayedCount++;
                scheduleNativeNotification("תזכורת כניסה לעבודה (נדחה)", `יש להכניס את הבדיקה של ${test.name} לעבודה`, test.workStartedDate, Math.floor(Math.random() * 1000000));
            }
        }
        return test;
    });
    saveAndRender();
}

window.completeTest = function(id) {
    tests = tests.map(test => {
        if (test.id === id) { test.status = 'completed'; test.completedAt = new Date().toISOString(); }
        return test;
    });
    saveAndRender();
}

function saveAndRender() {
    localStorage.setItem('genetic_tests', JSON.stringify(tests));
    render();
}

// --- שאר הפונקציות של הרינדור (בדיוק כמו שהיו) ---
function formatDateTime(iso) {
    const d = new Date(iso); return `${d.toLocaleDateString('he-IL')} בשעה ${d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
}

function getTypeBadge(type) {
    if (type === 'genome') return `<span class="bg-purple-100 text-purple-800 text-[10px] px-2 py-1 rounded font-bold">גנום</span>`;
    if (type === 'molecular') return `<span class="bg-teal-100 text-teal-800 text-[10px] px-2 py-1 rounded font-bold">מולקולרית</span>`;
    return `<span class="bg-slate-200 text-slate-800 text-[10px] px-2 py-1 rounded font-bold">אחר</span>`;
}

function render() {
    const workList = document.getElementById('work-list');
    const resultsList = document.getElementById('results-list');
    const historyList = document.getElementById('history-list');

    workList.innerHTML = ''; resultsList.innerHTML = ''; historyList.innerHTML = '';
    let tWork = 0, tRes = 0;

    tests.forEach(test => {
        const badge = getTypeBadge(test.type);
        if (test.status === 'pending_work' && test.hasWorkReminder) {
            tWork++;
            workList.innerHTML += `
                <div class="bg-white p-3 rounded-xl border shadow-sm space-y-3">
                    <div class="flex justify-between items-start">
                        <div><h3 class="font-bold text-sm">${test.name}</h3></div>${badge}
                    </div>
                    <div class="bg-amber-50 p-2 rounded text-xs text-amber-800 border border-amber-100">
                        <b>מועד בדיקה:</b> ${formatDateTime(test.workStartedDate)}
                    </div>
                    <div class="flex gap-2">
                        <button onclick="setWorkStatus(${test.id}, true)" class="flex-1 bg-indigo-600 text-white text-[11px] py-2 rounded-lg font-bold">נכנס לעבודה</button>
                        <button onclick="setWorkStatus(${test.id}, false)" class="flex-1 bg-slate-200 text-slate-700 text-[11px] py-2 rounded-lg font-bold">דחה ביום</button>
                    </div>
                </div>`;
        }
        if (test.status === 'pending_result') {
            tRes++;
            resultsList.innerHTML += `
                <div class="bg-white p-3 rounded-xl border shadow-sm space-y-3">
                    <div class="flex justify-between items-start">
                        <div><h3 class="font-bold text-sm">${test.name}</h3></div>${badge}
                    </div>
                    <div class="bg-indigo-50 p-2 rounded text-xs text-indigo-800 border border-indigo-100">
                        <b>מועד תוצאה:</b> ${formatDateTime(test.resultDate)}
                    </div>
                    <button onclick="completeTest(${test.id})" class="w-full bg-emerald-500 text-white text-xs py-2.5 rounded-lg font-bold">סיום</button>
                </div>`;
        }
        if (test.status === 'completed') {
            historyList.innerHTML += `<div class="bg-white p-2.5 rounded-lg border opacity-75 flex justify-between"><h3 class="font-bold text-xs">${test.name}</h3>${badge}</div>`;
        }
    });

    if(workList.innerHTML==='') workList.innerHTML = '<p class="text-xs text-center text-slate-400 py-4">ריק</p>';
    if(resultsList.innerHTML==='') resultsList.innerHTML = '<p class="text-xs text-center text-slate-400 py-4">ריק</p>';

    updateBadge('work-badge', tWork); updateBadge('results-badge', tRes);
    lucide.createIcons();
}

function updateBadge(id, count) {
    const el = document.getElementById(id);
    if (count > 0) { el.innerText = count; el.classList.remove('hidden'); } else { el.classList.add('hidden'); }
}

function switchTab(tab) {
    document.querySelectorAll('.page-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.replace('text-indigo-600', 'text-slate-400'));
    document.getElementById(`page-${tab}`).classList.remove('hidden');
    document.getElementById(`tab-${tab}`).classList.replace('text-slate-400', 'text-indigo-600');
}

// חיבור מאזיני אירועים ל-HTML
document.getElementById('btn-permission').addEventListener('click', requestPermissionManual);
document.getElementById('btn-test-notification').addEventListener('click', testOneMinuteNotification);
document.getElementById('add-form').addEventListener('submit', addReminder);
document.getElementById('enable-work-reminder').addEventListener('change', toggleWorkInputs);
document.querySelectorAll('.test-type-radio').forEach(radio => { radio.addEventListener('change', updateDefaults); });
document.getElementById('btn-clear-history').addEventListener('change', (e) => {
    if (e.target.value === 'all' && confirm('למחוק היסטוריה?')) {
        tests = tests.filter(test => test.status !== 'completed');
        saveAndRender();
    }
    e.target.value = '';
});
document.getElementById('tab-add').addEventListener('click', () => switchTab('add'));
document.getElementById('tab-work').addEventListener('click', () => switchTab('work'));
document.getElementById('tab-results').addEventListener('click', () => switchTab('results'));
document.getElementById('tab-history').addEventListener('click', () => switchTab('history'));