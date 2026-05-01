require('dotenv').config();

const vars = [
  'INSFORGE_API_URL',
  'INSFORGE_API_KEY', 
  'AWS_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_S3_BUCKET',
  'TINYFISH_API_KEY',
  'REDIS_URL',
  'PORT'
];

console.log('\n=== PathwayAI ENV Check ===\n');

vars.forEach(v => {
  const val = process.env[v];
  if (val && val.trim() !== '') {
    console.log(`✅ ${v} = ${val.substring(0, 8)}...`);
  } else {
    console.log(`❌ ${v} = NOT SET`);
  }
});

console.log('\n=== Done ===\n');