/**
 * Predefined deletion reasons for admin actions
 * These provide consistency and make audit logs more standardized
 */

export const DELETION_REASONS = {
  USER: [
    'Violation of Terms of Service',
    'Spam or bot account',
    'Inappropriate content',
    'User requested account deletion',
    'Duplicate account',
    'Inactive account cleanup',
    'Security concerns',
    'Policy violation'
  ],
  
  POST: [
    'Inappropriate content',
    'Spam or promotional content',
    'Copyright violation',
    'Harassment or bullying',
    'False information',
    'Duplicate content',
    'User reported content',
    'Policy violation'
  ],
  
  LISTING: [
    'Inappropriate item',
    'Fraudulent listing',
    'Duplicate listing',
    'Policy violation',
    'Prohibited item',
    'Misleading information',
    'User reported listing',
    'Expired or invalid'
  ],
  
  MESSAGE: [
    'Inappropriate content',
    'Spam or promotional message',
    'Harassment',
    'User reported message',
    'Policy violation',
    'Privacy violation'
  ],
  
  COMMENT: [
    'Inappropriate content',
    'Spam or promotional comment',
    'Harassment or bullying',
    'Off-topic content',
    'User reported comment',
    'Policy violation'
  ],

  CLEANUP: [
    'Scheduled automatic cleanup',
    'Manual cleanup requested',
    'Storage optimization',
    'Data retention policy',
    'System maintenance'
  ],

  RESTORE: [
    'Accidental deletion',
    'User appeal approved',
    'Policy clarification',
    'Administrative error',
    'User request reinstatement'
  ]
};

/**
 * Get deletion reasons for a specific content type
 */
export function getDeletionReasons(type: keyof typeof DELETION_REASONS): string[] {
  return DELETION_REASONS[type] || [];
}

/**
 * Get restoration reasons
 */
export function getRestorationReasons(): string[] {
  return DELETION_REASONS.RESTORE;
}

/**
 * Get cleanup reasons
 */
export function getCleanupReasons(): string[] {
  return DELETION_REASONS.CLEANUP;
}