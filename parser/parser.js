const fs = require('fs');
const path = require('path');

const inputDir = path.join(__dirname, 'input');
const outputDir = path.join(__dirname, 'output');

function readProperties(filePath) {
  const properties = {};
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  console.log(`Reading file: ${filePath}`);
  lines.forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      properties[key.trim()] = value.trim();
    }
  });
  return properties;
}

// remove values ending with '.ar.hsbc'
function removeArHsbcValues(properties) {
  const modifiedProperties = {};
  for (const key in properties) {
    if (properties[key].endsWith('.ar.hsbc')) {
      modifiedProperties[key] = properties[key].replace('.ar.hsbc', '');
    } else {
      modifiedProperties[key] = properties[key];
    }
  }
  return modifiedProperties;
}

function getMiddleGroup(str) {
  const parts = str.split('.');
  return parts.length === 3 ? parts[1] : null;
}

// Read .properties files from input directory
const appProperties = readProperties(path.join(inputDir, 'application.properties'));
console.log('appProperties:', appProperties);

let serverProperties = readProperties(path.join(inputDir, 'server.properties'));
console.log('serverProperties (before):', serverProperties);

// Remove values ending with '.ar.hsbc' from server.properties
serverProperties = removeArHsbcValues(serverProperties);
console.log('serverProperties (after):', serverProperties);

// Create output directory if it does not exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// Create a default.json file with all keys starting with 'default.'
const defaultJson = {};
for (const key in appProperties) {
  if (key.startsWith('default.')) {
    defaultJson[key] = appProperties[key];
  }
}
for (const key in serverProperties) {
  if (key.startsWith('default.')) {
    defaultJson[key] = serverProperties[key];
  }
}
fs.writeFileSync(path.join(outputDir, 'default.json'), JSON.stringify(defaultJson, null, 2));
console.log('File default.json saved');

const envKeys = fs.readFileSync(path.join(inputDir, 'envs.txt'), 'utf-8').split('\n').filter(Boolean);
console.log('envKeys:', envKeys);

envKeys.forEach(KEY => {
  console.log(`Processing KEY: ${KEY}`);
  // Look for envGroupList in application.properties
  const envGroupListKey = `${KEY}.envGroupList`;
  let envGroupList = appProperties[envGroupListKey];
  if (!envGroupList) {
    envGroupList = appProperties['default.envGroupList'];
  }

  if (envGroupList) {
    envGroupList = envGroupList.split(',');
    console.log(`envGroupList for ${KEY}:`, envGroupList);

    envGroupList.forEach(ENV => {
      const envJson = {};

      // Look for properties starting with KEY.ENV. in application.properties
      for (const key in appProperties) {
        if (key.endsWith('envGroupList')) continue;
        if (key.startsWith(`${KEY}.`)) {
          const newKey = key.replace(`${KEY}.`, '');
          envJson[newKey] = appProperties[key];
        }
      }

      // Look for properties starting with KEY. but not having ENV in application.properties
      for (const key in serverProperties) {
        if (key.startsWith(`${KEY}.${ENV}.`)) {
          const newKey = key.replace(`${KEY}.${ENV}.`, '');
          envJson[newKey] = serverProperties[key];
        } else if (key.startsWith(`${KEY}.`) && !key.includes(`.${ENV}.`) && !envGroupList.includes(getMiddleGroup(key))) {
          const newKey = key.replace(`${KEY}.`, '');
          envJson[newKey] = serverProperties[key];
        }
      }

      // Save to JSON file in the output directory
      const outputFilePath = path.join(outputDir, `${KEY}.${ENV}.json`);
      fs.writeFileSync(outputFilePath, JSON.stringify(envJson, null, 2));
      console.log(`File saved: ${outputFilePath}`);
    });
  }
});



