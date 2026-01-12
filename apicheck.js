const axios = require("axios");
const jwt = require("jsonwebtoken");

// 🌐 API base URL
const API_BASE = "https://zkbsgdbbhc.execute-api.us-east-1.amazonaws.com/Dev";

// 🔢 CONFIGURATION
const TOTAL_TEACHERS = 3;
const TOTAL_STUDENTS = 10;

const SPECIAL_TEACHER_USERNAME = "teacherAA1";
const SPECIAL_TEACHER_STUDENTS = 3;
const SPECIAL_TEACHER_BATCHES = 1;

const TOTAL_ACTIVE_BATCHES = 3;
const TOTAL_NULL_BATCHES = 1;
const TOTAL_BATCHES = TOTAL_ACTIVE_BATCHES + TOTAL_NULL_BATCHES;

const SPECIAL_ASSIGNMENTS = 2;
const SPECIAL_NOTES = 2;
const SPECIAL_MESSAGES = 2;

// 🕐 Utility Delay
async function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// 🛡 Safe POST with retry
async function safePost(url, data, label, token = null, retries = 3) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await axios.post(`${API_BASE}${url}`, data, { headers });
      console.log(`✅ Created ${label}`);
      return res.data;
    } catch (err) {
      const code = err.response?.status || "Unknown";
      const msg = err.response?.data?.error || err.message;
      console.log(`❌ Failed ${label} (attempt ${attempt}/${retries}): ${code} ${msg}`);
      if (attempt < retries) await delay(500 * attempt);
    }
  }
}

// ---------- CREATE TEACHERS ----------
async function createTeachers() {
  const teachers = [];

  for (let i = 1; i <= TOTAL_TEACHERS; i++) {
    const signupData = {
      firstName: `Teacher${i}`,
      lastName: "Test",
      userName: `teacherAA${i}`,
      password: `Password@${i}`,
      age: 30 + (i % 10),
      gender: i % 2 === 0 ? "male" : "female",
      addressLine1: `Address ${i}`,
      addressCity: "CityX",
      addressState: "StateY",
      pinCode: `5600${i}`,
      profilePicUrl: "https://example.com/profile.jpg",
      email: `teacher${i}@tasmai.com`,
      phoneNumber: `9000000${i.toString().padStart(3, "0")}`,
      upiId: `teacher${i}@upi`,
      accountNumber: `1234567890${i}`,
      accountName: `Teacher${i} Test`,
      ifscCode: `IFSC000${i.toString().padStart(3, "0")}`,
    };

    const res = await safePost("/signup/teachers", signupData, `Teacher ${i}`);
    if (!res?.token) continue;

    const decoded = jwt.decode(res.token) || {};
    teachers.push({ ...signupData, id: decoded.id || decoded._id || i, token: res.token });
  }

  console.log(`\n👩‍🏫 Created ${teachers.length} teacher(s)\n`);
  return teachers;
}

// ---------- CREATE STUDENTS ----------
async function createStudents(teachers) {
  const students = [];
  let studentId = 1;

  const specialTeacher = teachers.find((t) => t.userName === SPECIAL_TEACHER_USERNAME);
  if (!specialTeacher) {
    console.log("❌ Special teacher not found!");
    return students;
  }

  async function createStudentBatch(teacher, count) {
    const created = [];
    for (let i = 0; i < count; i++) {
      const uname = `studentA${studentId}${teacher.userName}`;
      const sData = {
        firstName: `Student${studentId}`,
        lastName: teacher.userName,
        userName: uname,
        password: `Password@${studentId}`,
        email: `${uname}@tasmai.com`,
        age: 10 + (studentId % 10),
        gender: studentId % 2 === 0 ? "male" : "female",
        addressLine1: `Address ${studentId}`,
        addressCity: "CityZ",
        addressState: "StateW",
        pinCode: `4000${studentId % 100}`,
        profilePicUrl: "https://example.com/student.jpg",
        parent1Name: `Parent${studentId}`,
        parent1Phone: `9990000${i.toString().padStart(3, "0")}`,
        parent1Email: `parent${studentId}@tasmai.com`,
        parent2Name: `ParentTwo${studentId}`,
        parent2Phone: `9990000${i.toString().padStart(3, "0")}`,
        parent2Email: `parent2_${studentId}@tasmai.com`,
      };

      const s = await safePost("/signup/students", sData, `Student ${studentId}`, teacher.token);
      if (s?.token) {
        const decoded = jwt.decode(s.token) || {};
        created.push({
          ...sData,
          id: decoded.id || decoded._id || `S${studentId}`,
          teacherId: teacher.id,
          token: s.token,
        });
      }

      studentId++;
      await delay(100);
    }
    return created;
  }

  students.push(...(await createStudentBatch(specialTeacher, SPECIAL_TEACHER_STUDENTS)));

  const remaining = TOTAL_STUDENTS - SPECIAL_TEACHER_STUDENTS;
  const perTeacher = Math.floor(remaining / (teachers.length - 1));

  for (const t of teachers.filter((x) => x.userName !== SPECIAL_TEACHER_USERNAME)) {
    students.push(...(await createStudentBatch(t, perTeacher)));
  }

  console.log(`\n👨‍🎓 Created ${students.length} student(s)\n`);
  return students;
}

// ---------- CREATE BATCHES ----------
async function createBatches(teachers) {
  const batches = [];
  let batchCounter = 1;

  for (const t of teachers) {
    const numBatches =
      t.userName === SPECIAL_TEACHER_USERNAME
        ? SPECIAL_TEACHER_BATCHES
        : batches.length < TOTAL_ACTIVE_BATCHES
        ? 1
        : 0;

    for (let i = 1; i <= numBatches; i++) {
      const bData = {
        name: `Batch ${batchCounter} (${t.userName})`,
        course: "General Studies",
        subject: "Mathematics",
        description: "Auto-created batch",
        paymentFrequency: "Monthly",
        paymentAmount: 1000,
        teacherId: t.id,
      };

      const b = await safePost("/batches", bData, `Batch ${batchCounter}`, t.token);
      if (b) batches.push({ ...b, teacherId: t.id });
      batchCounter++;
    }
  }

  for (let i = 1; i <= TOTAL_NULL_BATCHES; i++) {
    batches.push({
      id: `null-batch-${i}`,
      name: `Unassigned Batch ${batches.length + 1}`,
      teacherId: null,
    });
  }

  console.log(`\n📚 Created ${batches.length} total batches`);
  return batches;
}

// ---------- ASSIGN STUDENTS TO BATCHES ----------
function assignStudentsToBatches(students, batches) {
  const summary = {};
  const validBatches = batches.filter((b) => b.teacherId);

  for (const s of students) {
    const teacherBatches = validBatches.filter((b) => b.teacherId === s.teacherId);
    if (teacherBatches.length > 0) {
      const assignedBatch = teacherBatches[Math.floor(Math.random() * teacherBatches.length)];
      s.batchId = assignedBatch.id;
      summary[assignedBatch.name] = (summary[assignedBatch.name] || 0) + 1;
    } else {
      s.batchId = null;
      summary["Unassigned"] = (summary["Unassigned"] || 0) + 1;
    }
  }

  console.log("\n📊 Student-to-Batch Assignment Summary:");
  for (const [batch, count] of Object.entries(summary)) {
    console.log(`- ${batch}: ${count} student(s)`);
  }

  return students;
}

// 🆕 ---------- UPDATE STUDENT BATCH IN DATABASE ----------
async function updateStudentBatchAssignments(students, teachers) {
  console.log("\n🔄 Updating students with batch assignments...");

  for (const s of students) {
    if (!s.batchId) continue;

    const teacher = teachers.find((t) => t.id === s.teacherId);
    if (!teacher) continue;

    const updateData = {
      batches: [s.batchId],
    };

    try {
      await axios.put(`${API_BASE}/students/${s.id}`, updateData, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${teacher.token}`, // use teacher token
        },
      });
      console.log(`✅ Updated ${s.userName} -> batch ${s.batchId}`);
    } catch (err) {
      const code = err.response?.status || "Unknown";
      const msg = err.response?.data?.error || err.message;
      console.log(`❌ Failed to update ${s.userName}: ${code} ${msg}`);
    }

    await delay(100);
  }

  console.log("\n✅ All students batch updates completed!");
}

// ---------- HEAVY DATA ----------
async function createHeavyData(teacher, students, batches) {
  console.log("\n📦 Creating heavy data (assignments, notes, messages)...");

  for (let i = 1; i <= SPECIAL_ASSIGNMENTS; i++) {
    await safePost(
      "/assignments",
      {
        publishDate: new Date().toISOString(),
        submissionDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        batchId: batches[i % batches.length]?.id || "unknown",
        studentId: students[i % students.length]?.id,
        title: `Assignment ${i}`,
        details: `Auto assignment ${i}`,
        attachmentUrls: [`https://example.com/assignment${i}.pdf`],
      },
      `Assignment ${i}`,
      teacher.token
    );
  }

  for (let i = 1; i <= SPECIAL_NOTES; i++) {
    await safePost(
      "/notes",
      {
        publishDate: new Date().toISOString(),
        Title: `Note ${i}`,
        listUrls: [`https://example.com/note${i}.pdf`],
        content: `Auto note ${i}`,
        studentId: students[i % students.length]?.id,
        batchId: batches[i % batches.length]?.id || "unknown",
      },
      `Note ${i}`,
      teacher.token
    );
  }

  for (let i = 1; i <= SPECIAL_MESSAGES; i++) {
    const student = students[i % students.length];
    await safePost(
      "/messages",
      {
        subject: `Follow Up ${i}`,
        content: `Message ${i} from ${teacher.userName}`,
        sender: teacher.id,
        senderName: teacher.userName,
        senderType: "TEACHER",
        receiverName: student.userName,
        receiverType: "STUDENT",
        receiver: student.id,
        batchId: batches[i % batches.length]?.id || "unknown",
        timestamp: new Date().toISOString(),
        attachmentUrls: ["http://example.com/attachment1.pdf"],
      },
      `Message ${i}`,
      teacher.token
    );
  }

  console.log("✅ Heavy data generation completed!");
}

// ---------- MAIN ----------
(async function main() {
  console.log("🚀 Starting VERY SMALL TEST MODE data generation...");

  const teachers = await createTeachers();
  if (!teachers.length) return console.log("❌ No teachers created.");

  const students = await createStudents(teachers);
  const batches = await createBatches(teachers);

  const assignedStudents = assignStudentsToBatches(students, batches);

  // 🆕 Update student records in DB
  await updateStudentBatchAssignments(assignedStudents, teachers);

  const specialTeacher = teachers.find((t) => t.userName === SPECIAL_TEACHER_USERNAME);
  const specialStudents = students.filter((s) => s.teacherId === specialTeacher.id);
  const specialBatches = batches.filter((b) => b.teacherId === specialTeacher.id);

  await createHeavyData(specialTeacher, specialStudents, specialBatches);

  console.log("\n✅ VERY SMALL TEST MODE data generation completed successfully!");
})();
