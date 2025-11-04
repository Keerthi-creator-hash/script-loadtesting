const axios = require("axios");
const jwt = require("jsonwebtoken");

const API_BASE = "https://zkbsgdbbhc.execute-api.us-east-1.amazonaws.com/Dev";

// 🧑‍🏫 Configuration
const TOTAL_TEACHERS = 200;
const SPECIAL_TEACHER_USERNAME = "teacherXL1"; // correct main teacher
const SPECIAL_ASSIGNMENTS = 1000;
const SPECIAL_NOTES = 1000;
const SPECIAL_MESSAGES = 10000;
const TOTAL_ACTIVE_BATCHES = 50;
const TOTAL_NULL_BATCHES = 10;

// ---------- UTILS ----------
async function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function safePost(url, data, label, token = null, retries = 3) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  console.log(`🌐 POST ${API_BASE}${url}`);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await axios.post(`${API_BASE}${url}`, data, { headers });
      console.log(`✅ ${label}`);
      return res.data;
    } catch (err) {
      const code = err.response?.status || "Unknown";
      const msg = err.response?.data?.error || err.message;
      console.log(`❌ Failed ${label} (attempt ${attempt}/${retries}): ${code} ${msg}`);
      if (attempt < retries) await delay(200 * attempt);
    }
  }
}

// ---------- LOGIN EXISTING TEACHERS ----------
async function loginTeachers() {
  const teachers = [];

  for (let i = 1; i <= TOTAL_TEACHERS; i++) {
    const loginData = {
      userName: `teacherXL${i}`,  // username pattern
      password: `Password@${i}`,  // matching password
    };

    // 🧩 Make sure this matches your backend route
    const res = await safePost("/login/teachers", loginData, `Login Teacher ${i}`);
    if (!res?.token) continue;

    const decoded = jwt.decode(res.token) || {};
    teachers.push({
      userName: `teacherXL${i}`,
      id: decoded.id || decoded._id || i,
      token: res.token,
    });

    await delay(100);
  }

  console.log(`\n🔑 Logged in ${teachers.length} teacher(s)\n`);
  return teachers;
}


// ---------- CREATE BATCHES ----------
async function createBatches(teachers) {
  const batches = [];
  let batchCounter = 1;

  for (const t of teachers) {
    const numBatches =
      t.userName === SPECIAL_TEACHER_USERNAME
        ? 20
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

// ---------- ASSIGN EXISTING STUDENTS TO BATCHES ----------
async function assignStudentsToBatches(teacher, students, batches) {
  console.log("\n👩‍🏫 Assigning existing students to batches...\n");

  const teacherBatches = batches.filter((b) => b.teacherId === teacher.id);
  if (!teacherBatches.length) {
    console.log(`⚠️ No batches found for ${teacher.userName}`);
    return;
  }

  let assignedCount = 0;
  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const batch = teacherBatches[i % teacherBatches.length];

    const data = { batchId: batch.id, studentId: student.id };

    const res = await safePost(
      "/batchStudents",
      data,
      `Assign ${student.userName} → ${batch.name}`,
      teacher.token
    );
    if (res) assignedCount++;
    await delay(50);
  }

  console.log(`\n✅ Assigned ${assignedCount}/${students.length} students to ${teacherBatches.length} batches.\n`);
}

// ---------- HEAVY DATA CREATION ----------
async function createHeavyData(teacher, students, batches) {
  console.log("\n📦 Creating assignments, notes, and messages...\n");

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
    await delay(30);
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
    await delay(30);
  }

  for (let i = 1; i <= SPECIAL_MESSAGES; i++) {
    const student = students[i % students.length];
    await safePost(
      "/messages",
      {
        subject: `Follow Up Message ${i}`,
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
    await delay(20);
  }

  console.log("✅ Heavy data generation completed!");
}

// ---------- MAIN ----------
(async function main() {
  console.log("🚀 Resuming Data Generation from existing teachers...");

  // 1️⃣ Log in existing teachers
  const teachers = await loginTeachers();
  if (!teachers.length) return console.log("❌ No teachers logged in.");

  // 2️⃣ Create batches
  const batches = await createBatches(teachers);

  // 3️⃣ Pick special teacher (main data generator)
  const specialTeacher = teachers.find((t) => t.userName === SPECIAL_TEACHER_USERNAME);
  if (!specialTeacher) return console.log("❌ Special teacher not found.");

  // 4️⃣ Fetch already existing students
  let students = [];
  try {
    const res = await axios.get(`${API_BASE}/students`, {
      headers: { Authorization: `Bearer ${specialTeacher.token}` },
    });
    students = res.data || [];
    console.log(`📄 Loaded ${students.length} existing students`);
  } catch (err) {
    console.error("❌ Failed to fetch students:", err.response?.data || err.message);
  }

  if (!students.length) return console.log("⚠️ No students found to assign.");

  // 5️⃣ Assign students to batches
  await assignStudentsToBatches(specialTeacher, students, batches);

  // 6️⃣ Create assignments, notes, messages
  await createHeavyData(specialTeacher, students, batches);

  console.log("\n✅ Data generation completed successfully!");
})();
