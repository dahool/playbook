// requires Pipeline Utility Steps
pipeline {
    agent any

    environment {
        APP_PROPERTIES_FILE = '/mnt/shared/application.properties'
        SERVER_PROPERTIES_FILE = '/mnt/shared/server.properties'
        CONFIG_FILE = '/mnt/shared/config.xml'
        PLAYBOOK_FILE = '/mnt/shared/playbook_%s.yaml'
        BUILD_JOB = "${env.BUILD_ID}"
    }

    parameters {
        string(name: 'ENVIRONMENT', defaultValue: 'DEV', description: 'Environment to deploy (e.g., PRD-NAS)')
        string(name: 'ARTEFACT_NAME', defaultValue: 'hbar-teller-frontend', description: 'Artefact name to filter (optional)')
    }

    stages {
        stage('Load Properties') {
            steps {
                script {
                    // Load application.properties
                    appProperties = readProperties file: "${env.APP_PROPERTIES_FILE}"
                    // Load server.properties
                    serverProperties = readProperties file: "${env.SERVER_PROPERTIES_FILE}"
                    // fill properties normally available in G3 with env values
                    jobProperties = [ 'release_no': "${env.BUILD_JOB}" ]
                }
            }
        }

        stage('Parse and Generate Playbook') {
            steps {
                script {
                    // Parse config.xml
                    def config = new XmlSlurper().parse(new File(env.CONFIG_FILE))

                    // Find the environment group list
                    def envGroupList = appProperties[params.ENVIRONMENT + '.envGroupList'] ?: appProperties['default.envGroupList']
                    def envGroups = envGroupList.split(',')

                    envGroups.each { envGroup ->
                        echo "Processing environment group: ${envGroup}"

                        // Collect tasks from config.xml
                        config.DeployTasks.Repeat.AnsiblePlaybookTask.each { task ->
                            def playbookId = task.@PlaybookId.toString()
                            def taskId = task.@Id.toString()
                            def artefactScopes = task.Scopes?.ArtefactScope.collect { it.@Name.toString() }

                            def variables = task.Variables.Variable
                            def conditions = task.Conditions?.Condition*.@Value

                            echo "Evaluate scopes for: task ${taskId} artefact ${params.ARTEFACT_NAME}"

                            // Filter by artefact name if specified and scopes are defined
                            if (!artefactScopes.isEmpty() && !artefactScopes.contains(params.ARTEFACT_NAME)) {
                                echo "Skipping task ${taskId} for artefact ${params.ARTEFACT_NAME}"
                                return
                            }

                            echo 'Evaluate conditions'

                            // Evaluate conditions if defined
                            def shouldExecute = true
                            if (conditions) {
                                shouldExecute = conditions.every { condition ->
                                    def conditionValue = replaceVariables(condition.toString(), "${params.ENVIRONMENT}.${envGroup}")
                                    conditionValue.toBoolean()
                                }
                            }

                            if (shouldExecute) {
                                def ansibleVars = variables.collectEntries { variable ->
                                    [(variable.VariableName.toString()): replaceVariables(variable.VariableValue.toString(), "${params.ENVIRONMENT}.${envGroup}")]
                                }

                                ansibleVars.each { key, value ->
                                    echo "Variable: ${key} = ${value}"
                                }

                                def playbookFile = String.format("${env.PLAYBOOK_FILE}", playbookId)

                                if (!(new File(playbookFile)).exists()) {
                                    error "Playbook ID ${playbookId} not found"
                                }

                                // create vars parameter to pass to ansible
                                def ansibleVarsString = ansibleVars.collect { key, value ->
                                    "-e ${key}=${value}"
                                }.join(' ')

                                echo "Run playbook ${playbookFile} using ${ansibleVarsString}"

                                // Run the ansible playbook
                                // ansiblePlaybook playbook: resolvedPlaybookFile
                            } else {
                                echo "Skipping task ${taskId} due to failing conditions."
                            }
                        }
                    }
                }
            }
        }
    }


    post {
        success {
            echo 'Deployment completed'
        }
        failure {
            echo 'Deployment failed'
        }
        always {
            echo 'End deployment phase'
        }
    }
}

@NonCPS
def replaceVariables(value, envGroup) {
    // Regular expression to match the ${variable} pattern
    def pattern = /\$\{([a-zA-Z0-9._-]+)\}/
    // Replace all occurrences of ${variable} with corresponding property value
    def replacedValue = value.replaceAll(pattern) { match, variable ->
        def propValue
        if (variable.startsWith('application.property.')) {
            propValue = appProperties[variable.replace('application.property.', '')] ?: appProperties['default.' + variable.replace('application.property.', '')]
        } else if (variable.startsWith('server.property.')) {
            propValue = serverProperties[variable.replace('server.property.', '')] ?: serverProperties['default.' + variable.replace('server.property.', '')]
        } else if (variable.startsWith('server_from_list.property.')) {
            def key = envGroup + '.' + variable.replace('server_from_list.property.', '')
            propValue = serverProperties[key] ?: serverProperties['default.' + variable.replace('server_from_list.property.', '')]
        } else {
            propValue = jobProperties[variable]
        }
        return propValue ?: match // If value is still not found, keep the original text
    }

    return replacedValue
}
