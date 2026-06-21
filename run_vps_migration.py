import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("103.121.91.217", username="root", password="M@tkh@ut0tnh@t")

print("Executing migrate_db.py on VPS...")
stdin, stdout, stderr = ssh.exec_command("cd /var/www/PodLearn && ./venv/bin/python migrate_db.py")
print("STDOUT:")
print(stdout.read().decode("utf-8"))
print("STDERR:")
print(stderr.read().decode("utf-8"))

print("Restarting podlearn service...")
stdin, stdout, stderr = ssh.exec_command("systemctl restart podlearn")
print("STDOUT:")
print(stdout.read().decode("utf-8"))
print("STDERR:")
print(stderr.read().decode("utf-8"))

ssh.close()
