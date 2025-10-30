const fs = require("fs");
const path = require("path");

// ---------------- CONFIG ----------------
const TOTAL_TEACHERS = 200;
const TOTAL_STUDENTS = 10000;
const SPECIAL_TEACHER_INDEX = 1;
const SPECIAL_TEACHER_STUDENTS = 100;
const SPECIAL_TEACHER_BATCHES = 20;
const BATCHES_PER_OTHER_TEACHER = 50;

const SPECIAL_ASSIGNMENTS = 1000;
const SPECIAL_NOTES = 1000;
const SPECIAL_MESSAGES = 10000;

const OUTPUT_DIR = path.join(__dirname, "output");
// ----------------------------------------

// ---------- HELPERS ----------
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isoNowMinus(secondsOffset) {
  return new Date(Date.now() - secondsOffset * 1000).toISOString();
}

function randomGender() {
  return pickRandom(["male", "female", "do not reveal"]);
}

function randomAddress() {
  return {
    line1: `${Math.floor(Math.random() * 1000)} Main Street`,
    city: pickRandom(["Bangalore", "Mumbai", "Delhi", "Chennai", "Hyderabad", "Pune"]),
    state: pickRandom(["KA", "MH", "DL", "TN", "TS"]),
    pin: 560000 + Math.floor(Math.random() * 999)
  };
}

function randomPhone() {
  return "9" + Math.floor(100000000 + Math.random() * 899999999).toString();
}

function randomUpi() {
  return `user${Math.floor(Math.random() * 10000)}@upi`;
}

function randomIfsc() {
  return `BANK0${Math.floor(1000 + Math.random() * 8999)}`;
}

function randomAccountNumber() {
  return Math.floor(100000000000 + Math.random() * 899999999999).toString();
}

let nextId = 1;
function genId(prefix) {
  return `${prefix}${nextId++}`;
}
// ----------------------------------------

// ---------- TEACHERS ----------
const teachers = [];
for (let t = 1; t <= TOTAL_TEACHERS; t++) {
  const addr = randomAddress();
  teachers.push({
    id: `t${t}`,
    firstName: `Teacher${t}`,
    lastName: "User",
    userName: `teacher${t}`,
    password: `Password@${1000 + t}`,
    age: 25 + Math.floor(Math.random() * 20),
    gender: randomGender(),
    addressLine1: addr.line1,
    addressCity: addr.city,
    addressState: addr.state,
    pinCode: addr.pin,
    profilePicUrl: `https://picsum.photos/seed/teacher${t}/200`,
    email: `teacher${t}@tasmai.example`,
    phoneNumber: randomPhone(),
    upiId: randomUpi(),
    accountNumber: randomAccountNumber(),
    accountName: `Teacher${t} User`,
    ifscCode: randomIfsc(),
    meta: { isHeavy: t === SPECIAL_TEACHER_INDEX }
  });
}
// ----------------------------------------

// ---------- STUDENTS ----------
const students = [];
const studentAssignmentsByTeacher = {};
for (let t of teachers) studentAssignmentsByTeacher[t.id] = [];

let sidCounter = 1;
function createStudent(teacher) {
  const addr = randomAddress();
  const s = {
    id: `s${sidCounter}`,
    firstName: `Student${sidCounter}`,
    lastName: "User",
    userName: `student${sidCounter}`,
    password: `Password@${1000 + sidCounter}`,
    email: `student${sidCounter}@tasmai.example`,
    age: 10 + Math.floor(Math.random() * 10),
    addressLine1: addr.line1,
    addressCity: addr.city,
    addressState: addr.state,
    pinCode: addr.pin,
    profilePicUrl: `https://picsum.photos/seed/student${sidCounter}/200`,
    gender: randomGender(),
    parent1Name: `Parent${sidCounter}_A`,
    parent1Phone: randomPhone(),
    parent1Email: `parent${sidCounter}@example.com`,
    parent2Name: `Parent${sidCounter}_B`,
    parent2Phone: randomPhone(),
    parent2Email: `parent2_${sidCounter}@example.com`,
    teacherId: teacher.id,
    batches: []
  };
  sidCounter++;
  return s;
}

// special teacher students
for (let i = 0; i < SPECIAL_TEACHER_STUDENTS; i++) {
  const s = createStudent(teachers[SPECIAL_TEACHER_INDEX - 1]);
  students.push(s);
  studentAssignmentsByTeacher[s.teacherId].push(s.id);
}

// distribute remaining among others
let remaining = TOTAL_STUDENTS - SPECIAL_TEACHER_STUDENTS;
const otherTeachers = teachers.filter(t => t.id !== `t${SPECIAL_TEACHER_INDEX}`);
const basePerTeacher = Math.floor(remaining / otherTeachers.length);
let extra = remaining - basePerTeacher * otherTeachers.length;
for (let t of otherTeachers) {
  const count = basePerTeacher + (extra > 0 ? 1 : 0);
  if (extra > 0) extra--;
  for (let i = 0; i < count; i++) {
    const s = createStudent(t);
    students.push(s);
    studentAssignmentsByTeacher[t.id].push(s.id);
  }
}
// ----------------------------------------

// ---------- BATCHES ----------
const batches = [];

function createBatch(teacherId, batchNum, memberIds) {
  return {
    id: genId("b"),
    name: `Batch ${batchNum} (${teacherId})`,
    teacherId,
    course: pickRandom(["Mathematics", "Science", "English", "History", "Computer"]),
    subject: pickRandom(["Algebra", "Biology", "Grammar", "World History", "Coding"]),
    description: `Auto-generated batch ${batchNum}`,
    paymentFrequency: pickRandom(["monthly", "quarterly", "yearly"]),
    paymentAmount: Math.floor(1000 + Math.random() * 4000),
    paymentDayOfMonth: 1 + Math.floor(Math.random() * 28),
    members: memberIds === null ? null : memberIds,
    meta: { createdAt: isoNowMinus(Math.floor(Math.random() * 60 * 60 * 24 * 30)) }
  };
}

function takeStudents(teacherId, n) {
  const pool = studentAssignmentsByTeacher[teacherId];
  return pool.splice(0, n);
}

const heavyTeacher = teachers[SPECIAL_TEACHER_INDEX - 1];
const heavyPool = studentAssignmentsByTeacher[heavyTeacher.id];
for (let i = 1; i <= SPECIAL_TEACHER_BATCHES; i++) {
  const isNull = Math.random() < 0.3;
  const size = isNull ? 0 : Math.min(5 + Math.floor(Math.random() * 10), heavyPool.length);
  const members = size > 0 ? takeStudents(heavyTeacher.id, size) : null;
  batches.push(createBatch(heavyTeacher.id, i, members));
}

for (let t of otherTeachers) {
  const pool = studentAssignmentsByTeacher[t.id];
  for (let i = 1; i <= BATCHES_PER_OTHER_TEACHER; i++) {
    const isNull = Math.random() < 0.4;
    const size = isNull ? 0 : Math.min(10, pool.length);
    const members = size > 0 ? takeStudents(t.id, size) : null;
    batches.push(createBatch(t.id, i, members));
  }
}
// ----------------------------------------

// ---------- ASSIGNMENTS ----------
const assignments = [];
const heavyBatches = batches.filter(b => b.teacherId === heavyTeacher.id);
const heavyStudents = students.filter(s => s.teacherId === heavyTeacher.id);

for (let i = 1; i <= SPECIAL_ASSIGNMENTS; i++) {
  const batch = pickRandom(heavyBatches);
  const student = Math.random() < 0.5 ? pickRandom(heavyStudents) : null;
  assignments.push({
    id: genId("a"),
    teacherId: heavyTeacher.id,
    publishDate: isoNowMinus(i * 10),
    submissionDate: isoNowMinus(-(i % 7) * 24 * 3600),
    batchId: batch.id,
    studentId: student ? student.id : null,
    title: `Assignment ${i}`,
    details: `Auto-generated assignment ${i}`,
    attachmentUrls: [`https://example.com/a${i}.pdf`]
  });
}
// ----------------------------------------

// ---------- NOTES ----------
const notes = [];
for (let i = 1; i <= SPECIAL_NOTES; i++) {
  const batch = pickRandom(heavyBatches);
  const student = Math.random() < 0.5 ? pickRandom(heavyStudents) : null;
  notes.push({
    id: genId("n"),
    teacherId: heavyTeacher.id,
    publishDate: isoNowMinus(i * 6),
    Title: `Note ${i}`,
    listUrls: [`https://example.com/n${i}.pdf`],
    studentId: student ? student.id : null,
    batchId: batch.id,
    content: `Auto-generated note ${i}`
  });
}
// ----------------------------------------

// ---------- MESSAGES ----------
const messages = [];
const heavyStudentIds = heavyStudents.map(s => s.id);

for (let i = 1; i <= SPECIAL_MESSAGES; i++) {
  const senderIsTeacher = Math.random() < 0.5;
  const sender = senderIsTeacher ? heavyTeacher.id : pickRandom(heavyStudentIds);
  const receiver = senderIsTeacher ? pickRandom(heavyStudentIds) : heavyTeacher.id;

  messages.push({
    id: genId("m"),
    content: `Message ${i} - auto generated`,
    attachmentUrls: [`https://example.com/msg${i}.jpg`],
    replies: [
      {
        content: `Reply to message ${i}`,
        sender: pickRandom([heavyTeacher.id, pickRandom(heavyStudentIds)]),
        senderType: Math.random() > 0.5 ? "TEACHER" : "STUDENT",
        senderName: `User${Math.floor(Math.random() * 1000)}`,
        timestamp: isoNowMinus(i * 5),
        attachmentUrls: [`https://example.com/reply${i}.jpg`]
      }
    ]
  });
}
// ----------------------------------------

// ---------- WRITE OUTPUT ----------
ensureOutputDir();

function writeJSON(filename, obj) {
  const file = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(file, JSON.stringify(obj, null, 2), "utf8");
  console.log(`✅ Wrote ${filename} (${Array.isArray(obj) ? obj.length : 1} items)`);
}

writeJSON("teachers.json", teachers);
writeJSON("students.json", students);
writeJSON("batches.json", batches);
writeJSON("assignments.json", assignments);
writeJSON("notes.json", notes);
writeJSON("messages.json", messages);

console.log("\n--- SUMMARY ---");
console.log("Teachers:", teachers.length);
console.log("Students:", students.length);
console.log("Batches:", batches.length);
console.log("Assignments:", assignments.length);
console.log("Notes:", notes.length);
console.log("Messages:", messages.length);
console.log("Output directory:", OUTPUT_DIR);
