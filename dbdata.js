const fs = require("fs");
const path = require("path");
const { DynamoDBDocumentClient, BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");
const db = require("./dynamodb"); // <-- reuses your existing connection

const ddb = DynamoDBDocumentClient.from(db);
const OUTPUT_DIR = path.join(__dirname, "../../../output"); // adjust if needed

// ⚙️ Change these to your actual DynamoDB table names
const TABLES = {
  teachers: "Teachers",
  students: "Students",
  batches: "Batches",
  assignments: "Assignments",
  notes: "Notes",
  messages: "Messages"
};

// helper: batch write in chunks of 25
async function batchWriteAll(items, tableName) {
  const BATCH_SIZE = 25;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const request = {
      RequestItems: {
        [tableName]: chunk.map((item) => ({ PutRequest: { Item: item } })),
      },
    };
    try {
      await ddb.send(new BatchWriteCommand(request));
      console.log(` Inserted ${Math.min(i + BATCH_SIZE, items.length)}/${items.length} into ${tableName}`);
    } catch (err) {
      console.error(` Error inserting batch into ${tableName}:`, err.message);
    }
  }
}

// helper: read and seed one file
async function seedFile(filename, tableName) {
  const filePath = path.join(OUTPUT_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return;
  }
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  console.log(`\n Seeding ${data.length} records into table ${tableName}`);
  await batchWriteAll(data, tableName);
}

async function main() {
  console.log("🚀Starting DynamoDB seeding using existing connection...");

  await seedFile("teachers.json", TABLES.teachers);
  await seedFile("students.json", TABLES.students);
  await seedFile("batches.json", TABLES.batches);
  await seedFile("assignments.json", TABLES.assignments);
  await seedFile("notes.json", TABLES.notes);
  await seedFile("messages.json", TABLES.messages);

  console.log("\n All data seeded successfully!");
}

main().catch((err) => {
  console.error(" Error:", err);
});
