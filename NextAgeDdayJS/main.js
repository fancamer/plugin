const fetch = require("node-fetch");

const STASH_URL = process.env.STASH_URL || "http://localhost:9999/graphql";
const API_KEY = process.env.API_KEY || "your_api_key_here";

async function runGraphQL(query, variables = {}) {
  const response = await fetch(STASH_URL, {
    method: "POST",
    headers: {
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
      "ApiKey": API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });
  return response.json();
}

async function getAllPerformers() {
  const query = `
    query {
      allPerformers {
        id
        name
        birthdate
      }
    }
  `;
  const result = await runGraphQL(query);
  return result.data.allPerformers;
}

function calculateDdayAndNextAge(birthdate) {
  if (!birthdate) return null;

  const today = new Date();
  const birthDate = new Date(birthdate);

  if (isNaN(birthDate)) return null;

  let age = today.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear = 
    today.getMonth() > birthDate.getMonth() || 
    (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());
  if (!hasHadBirthdayThisYear) age--;

  let nextBirthdayYear = today.getFullYear();
  if (hasHadBirthdayThisYear) nextBirthdayYear += 1;

  const nextBirthday = new Date(nextBirthdayYear, birthDate.getMonth(), birthDate.getDate());
  const diffTime = nextBirthday - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const nextAge = age + 1;
  return `${nextAge}살까지 D-${diffDays}`;
}

async function updateCustomField(performerId, value) {
  const query = `
    mutation performerUpdate($input: PerformerUpdateInput!) {
      performerUpdate(input: $input) {
        id
      }
    }
  `;
  const variables = {
    input: {
      id: performerId,
      customFields: {
        NextAgeDday: value,
      },
    },
  };
  await runGraphQL(query, variables);
}

async function main() {
  const performers = await getAllPerformers();
  for (const performer of performers) {
    const ddayText = calculateDdayAndNextAge(performer.birthdate);
    if (ddayText) {
      console.log(`Updating ${performer.name}: ${ddayText}`);
      await updateCustomField(performer.id, ddayText);
    }
  }
}

main().catch((err) => {
  console.error("Error in NextAgeDdayJS plugin:", err);
  process.exit(1);
});