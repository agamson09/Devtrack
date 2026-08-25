-- Notification Preferences: per-type per-channel settings
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id INT PRIMARY KEY,

  -- Task notifications
  task_created_email TINYINT(1) DEFAULT 1,
  task_created_push TINYINT(1) DEFAULT 1,
  task_created_telegram TINYINT(1) DEFAULT 0,

  task_assigned_email TINYINT(1) DEFAULT 1,
  task_assigned_push TINYINT(1) DEFAULT 1,
  task_assigned_telegram TINYINT(1) DEFAULT 1,

  task_updated_email TINYINT(1) DEFAULT 0,
  task_updated_push TINYINT(1) DEFAULT 1,
  task_updated_telegram TINYINT(1) DEFAULT 0,

  task_deleted_email TINYINT(1) DEFAULT 0,
  task_deleted_push TINYINT(1) DEFAULT 1,
  task_deleted_telegram TINYINT(1) DEFAULT 0,

  status_changed_email TINYINT(1) DEFAULT 1,
  status_changed_push TINYINT(1) DEFAULT 1,
  status_changed_telegram TINYINT(1) DEFAULT 0,

  -- Comment notifications
  new_comment_email TINYINT(1) DEFAULT 0,
  new_comment_push TINYINT(1) DEFAULT 1,
  new_comment_telegram TINYINT(1) DEFAULT 0,

  -- Commit notifications
  new_commit_email TINYINT(1) DEFAULT 0,
  new_commit_push TINYINT(1) DEFAULT 1,
  new_commit_telegram TINYINT(1) DEFAULT 0,

  -- Mention notifications
  mention_email TINYINT(1) DEFAULT 1,
  mention_push TINYINT(1) DEFAULT 1,
  mention_telegram TINYINT(1) DEFAULT 1,

  -- Checklist notifications
  checklist_changed_email TINYINT(1) DEFAULT 0,
  checklist_changed_push TINYINT(1) DEFAULT 1,
  checklist_changed_telegram TINYINT(1) DEFAULT 0,

  -- File attachment notifications
  file_uploaded_email TINYINT(1) DEFAULT 0,
  file_uploaded_push TINYINT(1) DEFAULT 1,
  file_uploaded_telegram TINYINT(1) DEFAULT 0,

  -- Label notifications
  labels_changed_email TINYINT(1) DEFAULT 0,
  labels_changed_push TINYINT(1) DEFAULT 1,
  labels_changed_telegram TINYINT(1) DEFAULT 0,

  -- Deadline notifications
  deadline_email TINYINT(1) DEFAULT 1,
  deadline_push TINYINT(1) DEFAULT 1,
  deadline_telegram TINYINT(1) DEFAULT 1,

  -- Chat notifications
  chat_mention_email TINYINT(1) DEFAULT 0,
  chat_mention_push TINYINT(1) DEFAULT 1,
  chat_mention_telegram TINYINT(1) DEFAULT 0,

  chat_message_email TINYINT(1) DEFAULT 0,
  chat_message_push TINYINT(1) DEFAULT 1,
  chat_message_telegram TINYINT(1) DEFAULT 0,

  -- Group notifications
  group_mention_email TINYINT(1) DEFAULT 0,
  group_mention_push TINYINT(1) DEFAULT 1,
  group_mention_telegram TINYINT(1) DEFAULT 0,

  group_joined_email TINYINT(1) DEFAULT 0,
  group_joined_push TINYINT(1) DEFAULT 1,
  group_joined_telegram TINYINT(1) DEFAULT 0,

  group_message_email TINYINT(1) DEFAULT 0,
  group_message_push TINYINT(1) DEFAULT 1,
  group_message_telegram TINYINT(1) DEFAULT 0,

  -- Reaction notifications
  reaction_email TINYINT(1) DEFAULT 0,
  reaction_push TINYINT(1) DEFAULT 1,
  reaction_telegram TINYINT(1) DEFAULT 0,

  -- Call notifications
  call_missed_email TINYINT(1) DEFAULT 0,
  call_missed_push TINYINT(1) DEFAULT 1,
  call_missed_telegram TINYINT(1) DEFAULT 0,

  -- Project notifications
  project_created_email TINYINT(1) DEFAULT 0,
  project_created_push TINYINT(1) DEFAULT 1,
  project_created_telegram TINYINT(1) DEFAULT 0,

  project_updated_email TINYINT(1) DEFAULT 0,
  project_updated_push TINYINT(1) DEFAULT 1,
  project_updated_telegram TINYINT(1) DEFAULT 0,

  -- Deploy notifications
  deploy_executed_email TINYINT(1) DEFAULT 0,
  deploy_executed_push TINYINT(1) DEFAULT 1,
  deploy_executed_telegram TINYINT(1) DEFAULT 0,

  deploy_failed_email TINYINT(1) DEFAULT 1,
  deploy_failed_push TINYINT(1) DEFAULT 1,
  deploy_failed_telegram TINYINT(1) DEFAULT 1,

  -- IT Support notifications
  purchase_created_email TINYINT(1) DEFAULT 0,
  purchase_created_push TINYINT(1) DEFAULT 1,
  purchase_created_telegram TINYINT(1) DEFAULT 0,

  purchase_approved_email TINYINT(1) DEFAULT 1,
  purchase_approved_push TINYINT(1) DEFAULT 1,
  purchase_approved_telegram TINYINT(1) DEFAULT 0,

  inventory_assigned_email TINYINT(1) DEFAULT 1,
  inventory_assigned_push TINYINT(1) DEFAULT 1,
  inventory_assigned_telegram TINYINT(1) DEFAULT 0,

  -- User management notifications
  user_created_email TINYINT(1) DEFAULT 1,
  user_created_push TINYINT(1) DEFAULT 0,
  user_created_telegram TINYINT(1) DEFAULT 0,

  role_changed_email TINYINT(1) DEFAULT 1,
  role_changed_push TINYINT(1) DEFAULT 1,
  role_changed_telegram TINYINT(1) DEFAULT 0,

  -- Security notifications
  login_new_device_email TINYINT(1) DEFAULT 1,
  login_new_device_push TINYINT(1) DEFAULT 1,
  login_new_device_telegram TINYINT(1) DEFAULT 0,

  brute_force_email TINYINT(1) DEFAULT 1,
  brute_force_push TINYINT(1) DEFAULT 1,
  brute_force_telegram TINYINT(1) DEFAULT 1,

  -- System notifications
  system_config_email TINYINT(1) DEFAULT 1,
  system_config_push TINYINT(1) DEFAULT 1,
  system_config_telegram TINYINT(1) DEFAULT 0,

  agent_offline_email TINYINT(1) DEFAULT 0,
  agent_offline_push TINYINT(1) DEFAULT 1,
  agent_offline_telegram TINYINT(1) DEFAULT 0,

  -- Global sound setting
  notification_sound TINYINT(1) DEFAULT 1,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
