-- =====================================================
-- Performance Indexes Migration for DevTrack
-- Run: mysql -u root -p devtrack < scripts/add_performance_indexes.sql
-- =====================================================

-- Helper procedure to safely create indexes
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS safe_add_index(
    IN p_table_name VARCHAR(64),
    IN p_index_name VARCHAR(64),
    IN p_columns VARCHAR(255)
)
BEGIN
    DECLARE EXIT HANDLER FOR 1061 BEGIN END; -- Duplicate key name
    SET @sql = CONCAT('CREATE INDEX ', p_index_name, ' ON ', p_table_name, '(', p_columns, ')');
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
END //
DELIMITER ;

-- =============================================
-- 1. TASKS TABLE - Dashboard queries & filtering
-- =============================================

CALL safe_add_index('tasks', 'idx_tasks_status', 'status');
CALL safe_add_index('tasks', 'idx_tasks_status_deadline', 'status, deadline');
CALL safe_add_index('tasks', 'idx_tasks_status_priority', 'status, priority');
CALL safe_add_index('tasks', 'idx_tasks_project_status', 'project_id, status');
CALL safe_add_index('tasks', 'idx_tasks_assigned_status', 'assigned_to, status');
CALL safe_add_index('tasks', 'idx_tasks_created_by', 'created_by');
CALL safe_add_index('tasks', 'idx_tasks_timer', 'timer_started_at');

-- =============================================
-- 2. MESSAGES TABLE - Chat queries
-- =============================================

CALL safe_add_index('messages', 'idx_messages_group', 'group_id');
CALL safe_add_index('messages', 'idx_messages_read_status', 'sender_id, receiver_id, is_read');
CALL safe_add_index('messages', 'idx_messages_created', 'created_at');
CALL safe_add_index('messages', 'idx_messages_group_created', 'group_id, created_at');

-- =============================================
-- 3. NOTIFICATIONS TABLE - User notifications
-- =============================================

CALL safe_add_index('notifications', 'idx_notifications_type', 'type');

-- =============================================
-- 4. ACTIVITY LOGS - Activity feed queries
-- =============================================

CALL safe_add_index('activity_logs', 'idx_activity_target', 'target_type, target_id');
CALL safe_add_index('activity_logs', 'idx_activity_created', 'created_at');
CALL safe_add_index('activity_logs', 'idx_activity_user_created', 'user_id, created_at');

-- =============================================
-- 5. TASK COMMENTS - Comment listing
-- =============================================

CALL safe_add_index('task_comments', 'idx_comments_task_created', 'task_id, created_at');

-- =============================================
-- 6. TASK HISTORY - Change history
-- =============================================

CALL safe_add_index('task_history', 'idx_history_task_changed', 'task_id, changed_at');

-- =============================================
-- 7. SECURITY LOGS - Audit queries
-- =============================================

CALL safe_add_index('security_logs', 'idx_security_severity_created', 'severity, created_at');
CALL safe_add_index('security_logs', 'idx_security_event_created', 'event_type, created_at');

-- =============================================
-- 8. LOGIN ATTEMPTS - Brute force detection
-- =============================================

CALL safe_add_index('login_attempts', 'idx_login_email_ip_attempted', 'email, ip_address, attempted_at');

-- =============================================
-- 9. USER SESSIONS - Session validation
-- =============================================

CALL safe_add_index('user_sessions', 'idx_sessions_user_expires', 'user_id, expires_at');
CALL safe_add_index('user_sessions', 'idx_sessions_expires', 'expires_at');

-- =============================================
-- 10. PUSH SUBSCRIPTIONS - Push notifications
-- =============================================

CALL safe_add_index('push_subscriptions', 'idx_push_user_active', 'user_id, is_active');

-- =============================================
-- 11. PROJECTS - Project queries
-- =============================================

CALL safe_add_index('projects', 'idx_projects_owner', 'owner_id');

-- =============================================
-- 12. LABELS - Label queries
-- =============================================

CALL safe_add_index('labels', 'idx_labels_name', 'name');

-- =============================================
-- 13. TASK LABELS - Label assignment
-- =============================================

CALL safe_add_index('task_labels', 'idx_task_labels_task', 'task_id');
CALL safe_add_index('task_labels', 'idx_task_labels_label', 'label_id');

-- =============================================
-- 14. DEPLOY LOGS - Deployment history
-- =============================================

CALL safe_add_index('deploy_logs', 'idx_deploy_status', 'status');
CALL safe_add_index('deploy_logs', 'idx_deploy_task', 'task_id');

-- =============================================
-- 15. IT INVENTORY - Asset management
-- =============================================

CALL safe_add_index('it_inventory', 'idx_inventory_category', 'category');
CALL safe_add_index('it_inventory', 'idx_inventory_status', 'status');

-- =============================================
-- 16. PURCHASE REQUESTS - Request workflow
-- =============================================

CALL safe_add_index('it_purchase_requests', 'idx_purchase_status', 'status');
CALL safe_add_index('it_purchase_requests', 'idx_purchase_requester', 'requested_by');

-- =============================================
-- 17. FILE ACTIVITY - File change tracking
-- =============================================

CALL safe_add_index('file_activity_logs', 'idx_file_activity_path', 'file_path(100)');
CALL safe_add_index('file_activity_logs', 'idx_file_activity_action', 'action');
CALL safe_add_index('file_activity_logs', 'idx_file_activity_detected', 'detected_at');

-- =============================================
-- 18. TASK CHECKLISTS - Checklist queries
-- =============================================

CALL safe_add_index('task_checklists', 'idx_checklists_task', 'task_id');

-- =============================================
-- 19. TASK ATTACHMENTS - Attachment listing
-- =============================================

CALL safe_add_index('task_attachments', 'idx_attachments_task', 'task_id');

-- =============================================
-- ANALYZE TABLES - Update statistics
-- =============================================

ANALYZE TABLE tasks;
ANALYZE TABLE messages;
ANALYZE TABLE notifications;
ANALYZE TABLE activity_logs;
ANALYZE TABLE task_comments;
ANALYZE TABLE task_history;
ANALYZE TABLE security_logs;
ANALYZE TABLE login_attempts;
ANALYZE TABLE user_sessions;
ANALYZE TABLE push_subscriptions;
ANALYZE TABLE projects;
ANALYZE TABLE labels;
ANALYZE TABLE task_labels;
ANALYZE TABLE deploy_logs;
ANALYZE TABLE it_inventory;
ANALYZE TABLE it_purchase_requests;
ANALYZE TABLE file_activity_logs;
ANALYZE TABLE task_checklists;
ANALYZE TABLE task_attachments;

-- =============================================
-- CLEANUP - Drop helper procedure
-- =============================================

DROP PROCEDURE IF EXISTS safe_add_index;

-- =============================================
-- SHOW CREATED INDEXES
-- =============================================

SELECT 
    TABLE_NAME,
    INDEX_NAME,
    GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) as COLUMNS,
    NON_UNIQUE,
    INDEX_TYPE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'devtrack'
  AND INDEX_NAME != 'PRIMARY'
  AND INDEX_NAME NOT LIKE 'unique_%'
GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE, INDEX_TYPE
ORDER BY TABLE_NAME, INDEX_NAME;
