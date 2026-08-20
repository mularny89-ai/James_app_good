import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const jobStatuses = [
  // name, order, color, isBoardColumn, boardOrder
  ["Quote", 0, "#64748b", false, 0],
  ["To Start", 1, "#34368B", true, 1],
  ["In Progress", 2, "#0e7cc4", true, 2],
  ["Awaiting Information", 3, "#b45309", false, 0],
  ["Awaiting Client", 4, "#b45309", false, 0],
  ["Awaiting Architect", 5, "#b45309", false, 0],
  ["Awaiting Builder", 6, "#b45309", false, 0],
  ["Awaiting Inspection", 7, "#b45309", false, 0],
  ["On Hold", 8, "#64748b", false, 0],
  ["To Finalise", 9, "#7c3aed", true, 3],
  ["Ready to Issue", 10, "#7c3aed", false, 0],
  ["Ready to Invoice", 11, "#b91c1c", false, 0],
  ["Invoiced", 12, "#b91c1c", false, 0],
  ["Completed", 13, "#15803d", true, 4],
  ["Cancelled", 14, "#6b7280", false, 0],
];

const jobTypes = [
  "New Home", "Home Extension", "Wall Removal", "Retaining Wall", "Swimming Pool",
  "Deck", "Patio", "Carport", "Granny Flat", "Shed", "Slab",
  "Structural Inspection", "Structural Report", "Storm Damage", "Insurance Report",
  "Form 15", "Form 12", "Remedial Engineering", "Commercial", "Other",
];

// Task hierarchy: Category → List. "Completed" is a smart view, not a list.
// name, category, order, isSystem
const taskLists = [
  ["Jobs To Start", "Jobs", 1, true],
  ["Jobs In Progress", "Jobs", 2, true],
  ["Jobs To Be Revised", "Jobs", 3, true],
  ["Jobs To Finalise", "Jobs", 4, true],
  ["Form 15's To Be Issued", "Forms", 1, true],
  ["Form 12's To Be Issued", "Forms", 2, true],
  ["Quotes To Be Issued", "Finances", 1, true],
  ["Invoices To Be Issued", "Finances", 2, true],
  ["General To Do", "General", 1, true],
];

// Common service presets shared by quotes and invoices (editable in Settings)
const presets = [
  ["Structural Engineering Design", "Structural engineering design and documentation.", 0, true, 1, 1],
  ["Site Inspection", "Site inspections are charged at $400 + GST per inspection.", 400, true, 1, 2],
  ["Form 15", "Form 15 — Design/Compliance Certificate.", 0, true, 1, 3],
  ["Form 12", "Form 12 — Inspection Certificate.", 0, true, 1, 4],
  ["Structural Report", "Structural engineering report.", 0, true, 1, 5],
  ["Engineering Variation", "Variation to the engaged scope of works.", 0, true, 1, 6],
];

const inspectionTypes = [
  "Footing Inspection", "Slab Inspection", "Frame Inspection", "Structural Inspection",
  "Existing Structure Inspection", "Site Measure", "Retaining Wall Inspection",
  "Pool Inspection", "Final Inspection", "Defect Inspection", "Form 12 Inspection",
  "Consultation", "Other",
];

async function main() {
  await prisma.companySettings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  for (let i = 0; i < jobStatuses.length; i++) {
    const [name, order, color, isBoardColumn, boardOrder] = jobStatuses[i];
    await prisma.jobStatus.upsert({
      where: { name },
      update: {},
      create: { name, order, color, isBoardColumn, boardOrder },
    });
  }
  for (let i = 0; i < jobTypes.length; i++) {
    await prisma.jobType.upsert({ where: { name: jobTypes[i] }, update: {}, create: { name: jobTypes[i], order: i + 1 } });
  }
  // Upsert the task hierarchy. Then migrate any legacy "Completed" task list:
  // its tasks are marked completed and moved to General To Do, and the list
  // is removed (Completed is now a smart view, not a list).
  let generalId = null;
  for (const [name, category, order, isSystem] of taskLists) {
    const created = await prisma.taskList.upsert({
      where: { name },
      update: { category, order, isSystem },
      create: { name, category, order, isSystem },
    });
    if (name === "General To Do") generalId = created.id;
  }
  const legacyCompleted = await prisma.taskList.findUnique({ where: { name: "Completed" } });
  if (legacyCompleted) {
    await prisma.task.updateMany({
      where: { listId: legacyCompleted.id },
      data: { listId: generalId, completed: true, completedAt: new Date() },
    });
    await prisma.taskList.delete({ where: { id: legacyCompleted.id } });
  }
  for (const [name, description, unitPrice, gstApplicable, defaultQty, order] of presets) {
    const existing = await prisma.invoicePreset.findFirst({ where: { name }, select: { id: true } });
    if (!existing) {
      await prisma.invoicePreset.create({ data: { name, description, unitPrice, gstApplicable, defaultQty, order } });
    }
  }
  for (let i = 0; i < inspectionTypes.length; i++) {
    await prisma.inspectionType.upsert({ where: { name: inspectionTypes[i] }, update: {}, create: { name: inspectionTypes[i], order: i + 1 } });
  }
  console.log("Seed complete.");
}

main().finally(() => prisma.$disconnect());
