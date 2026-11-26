# __PROJECT_NAME__

An Ansible project that prepares Debian or Ubuntu servers and installs NGINX behind a firewall.

```text
ansible.cfg                 Inventory path, roles path, and SSH settings
requirements.yml            Collections to install
site.yml                    Runs the roles against the inventory groups
inventory/hosts.yml         Your servers
inventory/group_vars/       Variables shared by all hosts
roles/common/               Base packages and a deny-by-default firewall that keeps SSH open
roles/webserver/            NGINX, a templated home page, and the HTTP firewall rule
```

## Requirements

- ansible-core 2.15 or newer on Linux or macOS. On Windows, run Ansible from WSL, because the control node cannot be native Windows.
- Servers running Debian or Ubuntu with SSH access and a user that can use `sudo`. Ansible runs the roles with `become: true`.

```sh
python3 -m pip install --user ansible-core ansible-lint
ansible-galaxy collection install -r requirements.yml
```

## Set up the inventory

Edit `inventory/hosts.yml` and set `ansible_host` and `ansible_user` for each server. To use a server created by the **Terraform Linode** starter, run `terraform output instance_ipv4` there and copy the address. Check the connection with:

```sh
ansible all -m ansible.builtin.ping
```

## Check and run

```sh
ansible-playbook site.yml --syntax-check
ansible-lint
ansible-playbook site.yml --check --diff
ansible-playbook site.yml
```

`--check --diff` previews changes without making them. The playbook is idempotent, so you can run it again at any time. Open `http://<server address>` in a browser after the first run.

The firewall role denies all inbound traffic except the ports in `common_firewall_allowed_ports`, which includes SSH on port 22. If your SSH server listens on another port, add that port before you run the playbook. Otherwise the firewall will block your connection.

## Add a role or host

Create a role with `ansible-galaxy role init roles/<name>`, then add it to `site.yml`. Add more hosts under `webservers` or create a new group in `inventory/hosts.yml`, and put group-specific variables in `inventory/group_vars/<group>.yml`. Prefix each role's variables with the role name, such as `webserver_title`, to avoid collisions.

## Secrets

Do not commit passwords or tokens in plain text. Encrypt a variables file with `ansible-vault encrypt inventory/group_vars/secrets.yml`, and run the playbook with `--ask-vault-pass` or `--vault-password-file`. Git ignores `.vault_pass`.

[Ansible user guide](https://docs.ansible.com/ansible/latest/user_guide/index.html) · [ansible-lint](https://ansible.readthedocs.io/projects/lint/) · [community.general.ufw](https://docs.ansible.com/ansible/latest/collections/community/general/ufw_module.html)
