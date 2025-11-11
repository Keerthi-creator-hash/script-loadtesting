const axios = require("axios");
const jwt = require("jsonwebtoken");

// 🌐 API base URL
const API_BASE = "https://zkbsgdbbhc.execute-api.us-east-1.amazonaws.com/Dev";

// 🔢 CONFIGURATION — LARGE DATA MODE
const TOTAL_TEACHERS = 200;
const TOTAL_STUDENTS = 1000;

const SPECIAL_TEACHER_USERNAME = "teacherTAS1"; // <-- main teacher prefix (will match teacherAAAA1, teacherAAAA2, ...)
const SPECIAL_TEACHER_STUDENTS = 100;
const SPECIAL_TEACHER_BATCHES = 60;

const TOTAL_ACTIVE_BATCHES = 50; // total batches linked to teachers
const TOTAL_NULL_BATCHES = 10;   // unassigned batches

const SPECIAL_ASSIGNMENTS = 1000;
const SPECIAL_NOTES = 1000;
const SPECIAL_MESSAGES = 1000;

// // 🕐 Utility Delay (10 seconds)
const GLOBAL_DELAY = 10000;
async function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

// 🛡 Safe POST with retry and enforced delay
async function safePost(url, data, label, token = null, retries = 3) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await delay(GLOBAL_DELAY);
      const res = await axios.post(`${API_BASE}${url}`, data, { headers });
      console.log(`✅ Created ${label}`);
      return res.data;
    } catch (err) {
      const code = err.response?.status || "Unknown";
      const msg = err.response?.data?.error || err.message;
      console.log(`❌ Failed ${label} (attempt ${attempt}/${retries}): ${code} ${msg}`);
      if (attempt < retries) await delay(GLOBAL_DELAY);
    }
  }
  return null;
}

// ---------- LOGIN FUNCTION ----------
async function loginTeacher(userName, password) {
  try {
    await delay(GLOBAL_DELAY);
    const res = await axios.post(`${API_BASE}/login/teacher`, {
      userName,
      password
    }, { headers: { "Content-Type": "application/json" } });
    console.log(`🔑 Logged in teacher ${userName}`);
    return res.data.token;
  } catch (err) {
    console.log(`❌ Failed login for ${userName}: ${err.response?.data?.error || err.message}`);
    return null;
  }
}

// ---------- REFRESH TOKENS ----------
async function refreshTeacherTokens(teachers) {
  if (!Array.isArray(teachers)) return;
  console.log("\n🔄 Refreshing teacher tokens...");
  for (const t of teachers) {
    if (!t) {
      console.log("⚠️ Skipping undefined teacher entry");
      continue;
    }
    if (!t.userName || !t.password) {
      console.log(`⚠️ Skipping ${t?.userName || "unknown"} — missing userName/password`);
      continue;
    }
    const token = await loginTeacher(t.userName, t.password);
    if (token) t.token = token;
    else console.log(`⚠️ Could not refresh token for ${t.userName}`);
  }
}

// ---------- CREATE TEACHERS ----------
async function createTeachers() {
  const teachers = [];

  for (let i = 1; i <= TOTAL_TEACHERS; i++) {
    // make usernames like teacherAAAA1, teacherAAAA2, ...
    const signupData = {
      firstName: `Teacheri${i}`,
      lastName: "LargeTest",
      userName: `teacherTAS${i}`,
      password: `Password@${i}`,
      age: 28 + (i % 20),
      gender: i % 2 === 0 ? "male" : "female",
      addressLine1: `Address ${i}`,
      addressCity: "CityMega",
      addressState: "StatePro",
      pinCode: `5600${i}`,
      profilePicUrl: "https://example.com/profile.jpg",
      email: `teacher${i}@tasmai.com`,
      phoneNumber: `9000000${i.toString().padStart(3, "0")}`,
      upiId: `teacher${i}@upi`,
      accountNumber: `1234567890${i}`,
      accountName: `Teacher${i} LargeTest`,
      ifscCode: `IFSC000${i.toString().padStart(3, "0")}`,
    };

    const res = await safePost("/signup/teachers", signupData, `Teacher ${i}`);
    if (!res?.token) {
      console.log(`⚠️ No token returned for Teacher ${i}, skipping adding to list`);
      continue;
    }

    const decoded = jwt.decode(res.token) || {};
    // include password so we can re-login later
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
    console.log("❌ Special teacher not found! Continuing but special teacher's students will not be created.");
    // still proceed to create students for other teachers
  }

  async function createStudentBatch(teacher, count) {
    const created = [];
    for (let i = 0; i < count; i++) {
      const uname = `studentTAS${studentId}${teacher.userName.replace(/[^a-zA-Z0-9]/g, "")}`;

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
      } else {
        console.log(`⚠️ Student ${studentId} signup returned no token; skipping.`);
      }

      studentId++;
    }
    return created;
  }

  // If specialTeacher exists, create their students
  if (specialTeacher) {
    students.push(...(await createStudentBatch(specialTeacher, SPECIAL_TEACHER_STUDENTS)));
  }

  // Remaining teachers share rest of students
  const remaining = TOTAL_STUDENTS - (specialTeacher ? SPECIAL_TEACHER_STUDENTS : 0);
  const otherTeachers = teachers.filter((x) => x.userName !== SPECIAL_TEACHER_USERNAME);
  const perTeacher = otherTeachers.length > 0 ? Math.floor(remaining / otherTeachers.length) : 0;

  for (const t of otherTeachers) {
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
      else console.log(`⚠️ Failed to create batch ${batchCounter} for ${t.userName}`);
      batchCounter++;
    }
  }

  // Add unassigned batches
  for (let i = 1; i <= TOTAL_NULL_BATCHES; i++) {
    batches.push({
      id: `null-batch-${i}`,
      name: `Unassigned Batch ${batches.length + 1}`,
      teacherId: null,
    });
  }

  console.log(`\n📚 Created ${batches.length} total batches`);
  console.log(`🧮 ${TOTAL_ACTIVE_BATCHES} active, ${TOTAL_NULL_BATCHES} unassigned\n`);
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

// ---------- UPDATE STUDENT RECORDS ----------
async function updateStudentBatchAssignments(students, teachers) {
  console.log("\n🔄 Updating student batch assignments...");

  for (const s of students) {
    if (!s.batchId) continue;
    const teacher = teachers.find((t) => t.id === s.teacherId);
    if (!teacher) continue;

    try {
      await axios.put(
        `${API_BASE}/students/${s.id}`,
        { batches: [s.batchId] },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${teacher.token}`,
          },
        }
      );
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
  if (!teacher) {
    console.log("⚠️ No teacher provided for heavy data. Skipping assignments/notes/messages.");
    return;
  }
  console.log("\n📦 Creating large data (assignments, notes, messages)...");

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
    if (!student) {
      console.log(`⚠️ No student found for message ${i}; skipping.`);
      continue;
    }
    await safePost(
      "/messages",
      {
        subject: `Follow Up For All Doubts ${i}`,
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
  console.log("🚀 Starting LARGE DATA MODE generation...");

  const teachers = await createTeachers();
  if (!teachers.length) return console.log("❌ No teachers created.");

  const students = await createStudents(teachers);

  // 🔑 Re-login teachers before batches
  await refreshTeacherTokens(teachers);

  const batches = await createBatches(teachers);

  const assignedStudents = assignStudentsToBatches(students, batches);
  await updateStudentBatchAssignments(assignedStudents, teachers);

  // 🔑 Re-login special teacher before heavy data (only if it exists)
  const specialTeacher = teachers.find((t) => t.userName === SPECIAL_TEACHER_USERNAME);
  if (specialTeacher) {
    await refreshTeacherTokens([specialTeacher]);
    const specialStudents = students.filter((s) => s.teacherId === specialTeacher.id);
    const specialBatches = batches.filter((b) => b.teacherId === specialTeacher.id);
    await createHeavyData(specialTeacher, specialStudents, specialBatches);
  } else {
    console.log("⚠️ Special teacher not found — skipping heavy data (assignments/notes/messages).");
  }

  console.log("\n✅ LARGE DATA MODE completed successfully!");
})();
