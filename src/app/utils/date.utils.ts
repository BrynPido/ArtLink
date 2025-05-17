export const formatFullDate = (date: string | Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  };
  return new Date(date).toLocaleDateString('en-US', options);
};

export const formatTimeAgo = (date: string | Date): string => {
  const now = new Date();
  const timeStamp = new Date(date);
  const diff = now.getTime() - timeStamp.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 30) return 'Just now';
  if (seconds < 60) return `${seconds} seconds ago`;
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (weeks === 1) return '1 week ago';
  if (weeks < 4) return `${weeks} weeks ago`;
  if (months === 1) return '1 month ago';
  if (months < 12) return `${months} months ago`;
  if (years === 1) return '1 year ago';
  return `${years} years ago`;
};

// Shorter format for comments/posts (e.g. "2m", "3h", "5d")
export const formatShortTimeAgo = (date: string | Date): string => {
  const now = new Date();
  const timeStamp = new Date(date);
  const diff = now.getTime() - timeStamp.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  if (weeks < 4) return `${weeks}w`;
  if (months < 12) return `${months}mo`;
  return `${years}y`;
};

// Format date for post headers (e.g. "Mar 15")
export const formatPostDate = (date: string | Date): string => {
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric'
  };
  return new Date(date).toLocaleDateString('en-US', options);
};

// Format date for messages (shows time for today, date for older)
export const formatMessageDate = (date: string | Date): string => {
  const messageDate = new Date(date);
  const now = new Date();
  
  // If it's today, show only time
  if (messageDate.toDateString() === now.toDateString()) {
    return messageDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit'
    });
  }
  
  // If it's this year, show month and day
  if (messageDate.getFullYear() === now.getFullYear()) {
    return messageDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  }
  
  // If it's a different year, include the year
  return messageDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric'
  });
};