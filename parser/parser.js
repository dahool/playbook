const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const inputDir = path.join(__dirname, 'input');
const outputDir = path.join(__dirname, 'output');

const DEFAULTS = {
  'release_no': 'JENKINS'
}

// Function to read .properties files
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

function extractVariableValue(str) {
  const regex = /\${(.*?)}/g;
  let match;
  const results = [];
  while ((match = regex.exec(str)) !== null) {
    results.push(match[1].split('.').pop());
  }
  return results;
}

async function readXml(filePath) {
  const xmlData = fs.readFileSync(filePath, 'utf-8');
  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xmlData);
  return result;
}

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

// Create a default.json
let defaultJson = {};
for (const key in appProperties) {
  if (key.endsWith('envGroupList')) continue;
  if (key.startsWith('default.')) {
    defaultJson[key.replace('default.', '')] = appProperties[key];
  }
}
for (const key in serverProperties) {
  if (key.startsWith('default.')) {
    defaultJson[key.replace('default.', '')] = serverProperties[key];
  }
}

defaultJson = {...DEFAULTS,...defaultJson}

const envKeys = fs.readFileSync(path.join(inputDir, 'envs.txt'), 'utf-8').split('\n').filter(Boolean);
console.log('envKeys:', envKeys);

// Process deploy_config.xml
readXml(path.join(inputDir, 'deploy_config.xml')).then(xmlData => {
  const deployConfigVars = xmlData.DeployConfig.DeployTasks[0].Repeat[0].AnsiblePlaybookTask.flatMap(task => 
    task.Variables[0].Variable.map(variable => ({
      variableName: variable.variableName[0],
      variableValue: variable.variableValue[0]
    }))
  );

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

        for (const key in appProperties) {
          if (key.endsWith('envGroupList')) continue;
          if (key.startsWith(`${KEY}.`)) {
            envJson[key.replace(`${KEY}.`, '')] = appProperties[key];
          }
        }

        for (const key in serverProperties) {
          if (key.startsWith(`${KEY}.${ENV}.`)) {
            envJson[key.replace(`${KEY}.${ENV}.`, '')] = serverProperties[key];
          } else if (key.startsWith(`${KEY}.`) && !key.includes(`.${ENV}.`) && !envGroupList.includes(getMiddleGroup(key))) {
            envJson[key.replace(`${KEY}.`, '')] = serverProperties[key];
          }
        }

        // Process deployConfigVars
        deployConfigVars.forEach(({ variableName, variableValue }) => {
          let vars = extractVariableValue(variableValue);
          vars.forEach(val => {
            if (variableName !== val && (envJson[val] || defaultJson[val])) {
              defaultJson[variableName] = envJson[val] | defaultJson[val];
            } else if (envJson[val] == null && defaultJson[val] == null) {
              console.error(`WARN: ${val} is undefined`)
            }
          })
        });

        // Save to JSON file in the output directory
        const outputFilePath = path.join(outputDir, `${KEY}.${ENV}.json`);
        fs.writeFileSync(outputFilePath, JSON.stringify(envJson, null, 2));
        console.log(`File saved: ${outputFilePath}`);
      });
    }
  });
})
.then(() => {
  fs.writeFileSync(path.join(outputDir, 'default.json'), JSON.stringify(defaultJson, null, 2));
  console.log('File default.json saved');
})
.catch(err => {
  console.error('Error reading deploy_config.xml:', err);
});