const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');
const xml2js = require('xml2js');

async function parseXml(xmlFile) {
    const xmlData = fs.readFileSync(xmlFile, 'utf8');
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlData);
    const artefactNames = result.DeployConfig.Artefacts[0].Artefact.map(artefact => artefact.$.Name);
    console.log(artefactNames);
    return artefactNames;
}

async function splitPlaybooks(yamlFile, outputDir, artefactNames) {
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

    data.playbooks.forEach(playbook => {
        const playbookId = playbook.playbookId;
        let playbookData = playbook.playbookData;

        if (playbookId && playbookData) {
            playbookData = playbookData.map(item => {
                item.tasks.map(task => {
                    if (task.unarchive && artefactNames.includes(task.unarchive.src)) {
                        task.unarchive.src = '{{ artefactSource }}';
                    }
                    return task
                })
                return item;
            });

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

if (process.argv.length !== 5) {
    console.error('Usage: node index.js <config.xml> <input_playbook.yaml> <target_folder>');
    process.exit(1);
}

const xmlFile = process.argv[2];
const yamlFile = process.argv[3];
const outputDir = process.argv[4];

parseXml(xmlFile)
    .then(artefactNames => {
        splitPlaybooks(yamlFile, outputDir, artefactNames);
    })
    .catch(e => {
        console.error(`Error processing XML file: ${e}`);
    });
