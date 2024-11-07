import yaml
import os
import sys

def split_playbooks(yaml_file, output_dir):

    with open(yaml_file, 'r') as file:
        data = yaml.safe_load(file)

    print(f'Processing {yaml_file}')

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # split each section identified by playbookId
    for playbook in data:
        playbook_id = playbook.get('playbookId')
        playbook_data = playbook.get('playbookData')
        
        if playbook_id and playbook_data:
            # we make sure host is the first tag
            sorted_playbook_data = sorted(playbook_data, key=lambda x: 'hosts' in x)
            print(sorted_playbook_data)
            filename = os.path.join(output_dir, f'playbook_{playbook_id}.yaml')
            with open(filename, 'w') as outfile:
                yaml.dump(sorted_playbook_data, outfile, default_flow_style=False, sort_keys=False)
            print(f'Wrote {filename}')
    
    print("Process completed.")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(f'Usage: python {os.path.basename(__file__)} <input_playbook.yaml> <target_folder>')
        sys.exit(1)
    
    yaml_file = sys.argv[1]
    output_dir = sys.argv[2]
    
    split_playbooks(yaml_file, output_dir)
