const fetch = require("node-fetch");

const STASH_URL = process.env.STASH_URL || "http://localhost:9999/graphql";
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("Error: API_KEY 환경변수가 설정되어 있지 않습니다.");
  process.exit(1);
}

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
  const json = await response.json();
  if (json.errors) {
    console.error("GraphQL errors:", json.errors);
  }
  return json;
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

async function getCustomFields() {
  const query = `
    query {
      allCustomFields {
        id
        name
        type
      }
    }
  `;
  const result = await runGraphQL(query);
  return result.data.allCustomFields;
}

async function createCustomField(name) {
  const mutation = `
    mutation customFieldCreate($input: CustomFieldCreateInput!) {
      customFieldCreate(input: $input) {
        id
        name
      }
    }
  `;
  const variables = {
    input: {
      name: name,
      type: "STRING",
      entity: "PERFORMER"
    }
  };
  const result = await runGraphQL(mutation, variables);
  return result.data.customFieldCreate;
}

async function ensureCustomFieldExists(name) {
  const fields = await getCustomFields();
  const field = fields.find(f => f.name === name);
  if (field) {
    console.log(`Custom field '${name}' already exists.`);
    return field;
  } else {
    console.log(`Creating custom field '${name}'...`);
    return await createCustomField(name);
  }
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
  const mutation = `
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
  await runGraphQL(mutation, variables);
}

async function main() {
  // 1. Custom Field 생성 확인 및 생성
  const customFieldName = "NextAgeDday";
  await ensureCustomFieldExists(customFieldName);

  // 2. 배우 정보 가져와서 업데이트
  const performers = await getAllPerformers();
  for (const performer of performers) {
    const ddayText = calculateDdayAndNextAge(performer.birthdate);
    if (ddayText) {
      console.log(`Updating ${performer.name}: ${ddayText}`);
      await updateCustomField(performer.id, ddayText);
    }
  }
  console.log("업데이트 완료!");
}

main().catch(err => {
  console.error("NextAgeDdayJS 플러그인 실행 중 오류:", err);
  process.exit(1);
});
