const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

function splitPlaybooks(yamlFile, outputDir) {

    let data;
    try {
        data = yaml.load(fs.readFileSync(yamlFile, 'utf8'));
    } catch (e) {
        console.error(`Error reading YAML file: ${e}`);
        return;
    }

    console.log(`Processing ${yamlFile}`);

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // split each section identified by playbookId
    data.forEach(playbook => {
        const playbookId = playbook.playbookId;
        const playbookData = playbook.playbookData;

        if (playbookId && playbookData) {
            // # we make sure 'hosts' is the first tag
            const sortedPlaybookData = playbookData.sort((a, b) => ('hosts' in b) - ('hosts' in a));
            console.log(sortedPlaybookData);

            const filename = path.join(outputDir, `playbook_${playbookId}.yaml`);
            try {
                fs.writeFileSync(filename, yaml.dump(sortedPlaybookData, { noRefs: true, sortKeys: false }), 'utf8');
                console.log(`Wrote ${filename}`);
            } catch (e) {
                console.error(`Error writing file: ${e}`);
            }
        }
    });

    console.log("Process completed.");
}

if (process.argv.length !== 4) {
    console.error('Usage: node index.js <input_playbook.yaml> <target_folder>');
    process.exit(1);
}

const yamlFile = process.argv[2];
const outputDir = process.argv[3];

splitPlaybooks(yamlFile, outputDir);
