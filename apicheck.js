const axios = require("axios");
const faker = require("faker");

const API_BASE = "http://localhost:3000"; 
const TOTAL_TEACHERS = 200;
const TOTAL_STUDENTS = 10000;

const SPECIAL_TEACHER_ID = 1;
const SPECIAL_TEACHER_STUDENTS = 100;
const SPECIAL_TEACHER_BATCHES = 20;

const SPECIAL_ASSIGNMENTS = 1000;
const SPECIAL_NOTES = 1000;
const SPECIAL_MESSAGES = 10000;

async function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// Helper to safely post
async function safePost(url, data, label) {
  try {
    const res = await axios.post(`${API_BASE}${url}`, data);
    console.log(` Created ${label}`);
    return res.data;
  } catch (err) {
    console.log(`Failed ${label}: ${err.response?.status} ${err.response?.data?.message || err.message}`);
  }
}

// ---------- TEACHERS ----------
async function createTeachers() {
  const teachers = [];
  for (let i = 1; i <= TOTAL_TEACHERS; i++) {
    const data = {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      userName: `teacher${i}`,
      password: `Password@${i}`,
      email: `teacher${i}@tasmai.test`,
      phoneNumber: faker.phone.phoneNumber("9#########"),
    };
    const t = await safePost("/teachers", data, `Teacher ${i}`);
    if (t) teachers.push(t);
    await delay(100); // to avoid overloading your API
  }
  return teachers;
}

// ---------- STUDENTS ----------
async function createStudents(teachers) {
  const students = [];
  let studentId = 1;

  // Teacher 1 -> 100 students
  const specialTeacher = teachers.find(t => t.userName === "teacher1");
  for (let i = 0; i < SPECIAL_TEACHER_STUDENTS; i++) {
    const s = await safePost("/students", {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      userName: `student${studentId}`,
      password: `Password@${studentId}`,
      email: `student${studentId}@tasmai.test`,
      teacherId: specialTeacher.id
    }, `Student ${studentId}`);
    students.push(s);
    studentId++;
  }

  // Other teachers get remaining students
  const remaining = TOTAL_STUDENTS - SPECIAL_TEACHER_STUDENTS;
  const perTeacher = Math.floor(remaining / (teachers.length - 1));
  for (let t of teachers.filter(x => x.id !== specialTeacher.id)) {
    for (let i = 0; i < perTeacher; i++) {
      const s = await safePost("/students", {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        userName: `student${studentId}`,
        password: `Password@${studentId}`,
        email: `student${studentId}@tasmai.test`,
        teacherId: t.id
      }, `Student ${studentId}`);
      students.push(s);
      studentId++;
    }
  }
  return students;
}

// ---------- BATCHES ----------
async function createBatches(teachers, students) {
  const batches = [];

  // Special teacher
  const t1 = teachers.find(t => t.userName === "teacher1");
  const t1Students = students.filter(s => s.teacherId === t1.id);
  for (let i = 1; i <= SPECIAL_TEACHER_BATCHES; i++) {
    const members = i <= 10
      ? t1Students.slice((i - 1) * 5, i * 5).map(s => s.id)
      : null;
    const b = await safePost("/batches", {
      teacherId: t1.id,
      name: `Batch ${i} (T1)`,
      members
    }, `Batch ${i} (Teacher 1)`);
    batches.push(b);
  }

  // Other teachers
  for (let t of teachers.filter(x => x.id !== t1.id)) {
    const teacherStudents = students.filter(s => s.teacherId === t.id);
    for (let i = 1; i <= 50; i++) {
      const rnd = Math.random();
      let members = null;
      if (rnd < 0.3) members = teacherStudents.slice(0, 10).map(s => s.id);
      else if (rnd < 0.6) members = [];
      else members = null;
      const b = await safePost("/batches", {
        teacherId: t.id,
        name: `Batch ${i} (${t.userName})`,
        members
      }, `Batch ${i} (${t.userName})`);
      batches.push(b);
    }
  }

  return batches;
}

// ---------- Assignments / Notes / Messages ----------
async function createHeavyData(teacher, students, batches) {
  console.log("\nCreating heavy data for Teacher 1...");

  for (let i = 1; i <= SPECIAL_ASSIGNMENTS; i++) {
    await safePost("/assignments", {
      teacherId: teacher.id,
      batchId: faker.random.arrayElement(batches).id,
      title: `Assignment ${i}`,
      details: `Auto-generated assignment ${i}`
    }, `Assignment ${i}`);
  }

  for (let i = 1; i <= SPECIAL_NOTES; i++) {
    await safePost("/notes", {
      teacherId: teacher.id,
      batchId: faker.random.arrayElement(batches).id,
      title: `Note ${i}`,
      content: `Auto note ${i}`
    }, `Note ${i}`);
  }

  for (let i = 1; i <= SPECIAL_MESSAGES; i++) {
    const student = faker.random.arrayElement(students);
    await safePost("/messages", {
      senderId: teacher.id,
      receiverId: student.id,
      content: `Message ${i} from teacher`
    }, `Message ${i}`);
  }

  console.log(" Heavy data created for Teacher 1");
}

// ---------- MAIN ----------
(async function main() {
  console.log(" Starting API data generation...");

  const teachers = await createTeachers();
  const students = await createStudents(teachers);
  const batches = await createBatches(teachers, students);

  const t1 = teachers.find(t => t.userName === "teacher1");
  const t1Students = students.filter(s => s.teacherId === t1.id);
  const t1Batches = batches.filter(b => b && b.teacherId === t1.id);

  await createHeavyData(t1, t1Students, t1Batches);

  console.log("\n🎉 Data generation via API completed successfully!");
})();
