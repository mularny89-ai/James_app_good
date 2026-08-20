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

const taskLists = [
  ["General To Do", 1, true],
  ["Jobs To Start", 2, true],
  ["Jobs In Progress", 3, true],
  ["Jobs To Finalise", 4, true],
  ["Completed", 5, true],
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
  for (const [name, order, isSystem] of taskLists) {
    await prisma.taskList.upsert({ where: { name }, update: {}, create: { name, order, isSystem } });
  }
  for (let i = 0; i < inspectionTypes.length; i++) {
    await prisma.inspectionType.upsert({ where: { name: inspectionTypes[i] }, update: {}, create: { name: inspectionTypes[i], order: i + 1 } });
  }
  console.log("Seed complete.");
}

main().finally(() => prisma.$disconnect());
