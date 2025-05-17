import { ChangeDetectorRef, Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from '../../../services/data.service';
import { ToastService } from '../../../services/toast.service';
import { TimeAgoPipe } from '../../../utils/time-ago.pipe';
import { WebSocketService } from '../../../services/websocket.service';
import Swal from 'sweetalert2';
import { NotificationStateService } from '../../../services/notification-state.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-post',
  templateUrl: './post.component.html',
  styleUrls: ['./post.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, TimeAgoPipe]
})
export class PostComponent implements OnInit, OnDestroy {
  post?: any;
  currentUser: any;
  currentMediaIndex: number = 0;
  likesCountMap: { [key: number]: number } = {};
  likedPosts: { [key: number]: boolean } = {};
  savedPosts: { [key: number]: boolean } = {};
  newComment: string = '';
  replyingTo: number | null = null;
  replyContent: string = '';
  commentLikes: { [key: number]: boolean } = {};
  commentLikeCounts: { [key: number]: number } = {};
  currentReplyLevel: number = 0;
  loading = true;
  isFollowing: boolean = false;
  showFollowButton: boolean = false;
  private notificationSubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private dataService: DataService,
    private cdr: ChangeDetectorRef,
    private toastService: ToastService,
    private router: Router,
    private webSocketService: WebSocketService,
    private notificationState: NotificationStateService
  ) {
    this.currentUser = this.dataService.getCurrentUser();
  }

  ngOnInit(): void {
    // Subscribe to WebSocket notifications
    this.notificationSubscription = this.webSocketService.notifications$.subscribe(messages => {
      if (messages.length > 0) {
        const latestMessage = messages[messages.length - 1];
        if (typeof latestMessage?.content === 'object' && 'postId' in latestMessage.content) {
          if (latestMessage.content.postId === this.post?.id) {
            // Handle real-time updates for the current post
            this.handleRealTimeUpdate(latestMessage.content);
          }
        }
      }
    });

    const postId = this.route.snapshot.paramMap.get('id');
    if (postId) {
      this.dataService.getPostById(postId).subscribe({
        next: (response) => {
          this.post = response.payload;
          this.loading = false;
          if (this.post?.id) {
            this.likedPosts[this.post.id] = !!this.post.likedByUser;
            this.savedPosts[this.post.id] = !!this.post.savedByUser;
            this.likesCountMap[this.post.id] = this.post.likes || 0;
            
            // Initialize comment likes state
            if (this.post.comments) {
              this.post.comments.forEach((comment: any) => {
                this.commentLikes[comment.id] = comment.likedByUser || false;
                this.commentLikeCounts[comment.id] = comment.likes || 0;
                
                // Also handle replies if they exist
                if (comment.replies) {
                  comment.replies.forEach((reply: any) => {
                    this.commentLikes[reply.id] = reply.likedByUser || false;
                    this.commentLikeCounts[reply.id] = reply.likes || 0;
                  });
                }
              });
            }
          }

          this.showFollowButton = this.currentUser?.id !== this.post?.author?.id;
          if (this.showFollowButton && this.post?.author?.id) {
            this.dataService.isFollowing(this.post.author.id).subscribe({
              next: (res) => {
                if (res && res.payload && typeof res.payload.following === 'boolean') {
                  this.isFollowing = res.payload.following;
                }
              },
              error: () => {
                this.isFollowing = false;
                console.error('Error checking follow status');
              }
            });
          }

          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error fetching post:', error);
          this.loading = false;
        }
      });
    }
  }

  private handleRealTimeUpdate(content: any) {
    switch (content.type) {
      case 'COMMENT':
        // Update comments in real-time
        if (!this.post.comments) {
          this.post.comments = [];
        }
        if (content.comment) {
          // Handle both new comments and replies
          if (content.comment.parentId) {
            // This is a reply
            const addReplyToComment = (comments: any[]): boolean => {
              for (let comment of comments) {
                if (comment.id === content.comment.parentId) {
                  if (!comment.replies) {
                    comment.replies = [];
                  }
                  comment.replies.unshift(content.comment);
                  this.commentLikes[content.comment.id] = false;
                  this.commentLikeCounts[content.comment.id] = 0;
                  return true;
                }
                if (comment.replies && comment.replies.length) {
                  if (addReplyToComment(comment.replies)) {
                    return true;
                  }
                }
              }
              return false;
            };

            if (addReplyToComment(this.post.comments)) {
              this.toastService.showToast('New reply added', 'info');
            }
          } else {
            // This is a new comment
            this.post.comments.unshift(content.comment);
            this.commentLikes[content.comment.id] = false;
            this.commentLikeCounts[content.comment.id] = 0;
            this.toastService.showToast('New comment added', 'info');
          }
          this.cdr.markForCheck();
        }
        break;

      case 'LIKE':
        // Update likes in real-time
        if (content.postId === this.post.id) {
          this.dataService.getPostById(this.post.id).subscribe({
            next: (response) => {
              const oldLikes = this.post.likes || 0;
              this.post = response.payload;
              
              // Show toast only if likes count changed
              if (oldLikes !== this.post.likes) {
                this.toastService.showToast(
                  oldLikes < this.post.likes ? 'Someone liked your post' : 'Someone unliked your post',
                  'info'
                );
              }
              
              this.likedPosts[this.post.id] = this.post.likedByUser;
              this.likesCountMap[this.post.id] = this.post.likes;
              this.cdr.markForCheck();
            },
            error: (error) => {
              console.error('Error updating post likes:', error);
              this.toastService.showToast('Error updating likes', 'error');
            }
          });
        }
        break;

      case 'DELETE_COMMENT':
        if (content.commentId) {
          // Remove the deleted comment from UI
          const removeCommentRecursively = (comments: any[]): boolean => {
            for (let i = 0; i < comments.length; i++) {
              if (comments[i].id === content.commentId) {
                comments.splice(i, 1);
                return true;
              }
              if (comments[i].replies && comments[i].replies.length) {
                if (removeCommentRecursively(comments[i].replies)) {
                  return true;
                }
              }
            }
            return false;
          };

          if (this.post?.comments && removeCommentRecursively(this.post.comments)) {
            this.toastService.showToast('Comment was deleted', 'info');
            this.cdr.markForCheck();
          }
        }
        break;
    }
  }

  previousMedia(): void {
    if (this.currentMediaIndex > 0) {
      this.currentMediaIndex--;
    }
  }

  nextMedia(): void {
    if (this.currentMediaIndex < (this.post?.media?.length || 0) - 1) {
      this.currentMediaIndex++;
    }
  }

  isLiked(postId: number): boolean {
    return this.likedPosts[postId] || false;
  }

  isSaved(postId: number): boolean {
    return this.savedPosts[postId] || false;
  }

  likesCount(postId: number): number {
    return this.likesCountMap[postId] || 0;
  }

  toggleLike(postId: number): void {
    const userId = this.currentUser.id;
    this.dataService.likePost(postId, userId).subscribe({
      next: (response) => {
        this.likedPosts[postId] = !this.likedPosts[postId];
        this.likesCountMap[postId] += this.likedPosts[postId] ? 1 : -1;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error toggling like:', err);
      }
    });
  }

  toggleSave(postId: number): void {
    const userId = this.currentUser.id;
    this.dataService.savePost(postId, userId).subscribe({
      next: (response) => {
        this.savedPosts[postId] = !this.savedPosts[postId];
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error toggling save:', err);
      }
    });
  }

  addComment(): void {
    if (!this.post || !this.newComment.trim()) return;
    
    this.dataService.addComment(this.post.id, this.newComment).subscribe({
      next: (response) => {
        if (!this.post?.comments) {
          this.post.comments = [];
        }
        // Properly structure the comment with author information
        const newComment = {
          ...response.payload,
          author: {
            id: this.currentUser.id,
            name: this.currentUser.name,
            username: this.currentUser.username,
            profileImage: this.currentUser.profileImage
          }
        };
        this.post.comments.unshift(newComment);
        this.commentLikes[newComment.id] = false;
        this.commentLikeCounts[newComment.id] = 0;
        this.newComment = '';

        // Send WebSocket notification for real-time update
        this.webSocketService.sendNotification(this.post.author.id, {
          type: 'COMMENT',
          message: `${this.currentUser.username} commented on your post`,
          userId: this.currentUser.id,
          postId: this.post.id,
          commentId: newComment.id,
          comment: newComment,
          timestamp: new Date().toISOString()
        });

        this.toastService.showToast('Comment added successfully', 'success');
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error adding comment:', error);
        this.toastService.showToast('Error adding comment', 'error');
      }
    });
  }

  startReply(commentId: number, level: number): void {
    this.replyingTo = commentId;
    this.currentReplyLevel = level;
    this.replyContent = '';
  }

  cancelReply(): void {
    this.replyingTo = null;
    this.replyContent = '';
  }

  submitReply(commentId: number): void {
    if (!this.replyContent.trim()) return;

    this.dataService.addComment(this.post.id, this.replyContent, commentId).subscribe({
      next: (response) => {
        // Structure the reply with author information
        const newReply = {
          ...response.payload,
          author: {
            id: this.currentUser.id,
            name: this.currentUser.name,
            username: this.currentUser.username,
            profileImage: this.currentUser.profileImage
          }
        };

        // Find the parent comment at any level and add the reply
        const addReplyToComment = (comments: any[]): boolean => {
          for (let comment of comments) {
            if (comment.id === commentId) {
              if (!comment.replies) {
                comment.replies = [];
              }
              comment.replies.unshift(newReply);
              this.commentLikes[newReply.id] = false;
              this.commentLikeCounts[newReply.id] = 0;

              // Send WebSocket notification for reply
              if (comment.author.id !== this.currentUser.id) {
                this.webSocketService.sendNotification(comment.author.id, {
                  type: 'COMMENT',
                  message: `${this.currentUser.username} replied to your comment`,
                  userId: this.currentUser.id,
                  postId: this.post.id,
                  commentId: newReply.id,
                  comment: newReply,
                  timestamp: new Date().toISOString()
                });
              }
              return true;
            }
            if (comment.replies && comment.replies.length) {
              if (addReplyToComment(comment.replies)) {
                return true;
              }
            }
          }
          return false;
        };

        if (this.post?.comments) {
          addReplyToComment(this.post.comments);
        }
        this.cancelReply();
        this.toastService.showToast('Reply added successfully', 'success');
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error adding reply:', error);
        this.toastService.showToast('Error adding reply', 'error');
      }
    });
  }

  toggleCommentLike(commentId: number): void {
    this.dataService.likeComment(commentId).subscribe({
      next: (response) => {
        if (response.payload) {
          this.commentLikes[commentId] = response.payload.liked;
          this.commentLikeCounts[commentId] = response.payload.likeCount;
          this.cdr.markForCheck();
        }
      },
      error: (error) => {
        console.error('Error toggling comment like:', error);
      }
    });
  }

  isCommentLiked(commentId: number): boolean {
    return this.commentLikes[commentId] || false;
  }

  getCommentLikeCount(commentId: number): number {
    return this.commentLikeCounts[commentId] || 0;
  }

  canDeleteComment(comment: any): boolean {
    if (!this.currentUser) return false;
    return this.currentUser.id === comment.author.id || // Comment author
           this.currentUser.id === this.post?.author?.id; // Post author
  }

  deleteComment(commentId: number): void {
    Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.dataService.deleteComment(commentId).subscribe({
          next: () => {
            // Remove the comment from the UI
            const removeCommentRecursively = (comments: any[]): boolean => {
              for (let i = 0; i < comments.length; i++) {
                if (comments[i].id === commentId) {
                  comments.splice(i, 1);
                  return true;
                }
                if (comments[i].replies && comments[i].replies.length) {
                  if (removeCommentRecursively(comments[i].replies)) {
                    return true;
                  }
                }
              }
              return false;
            };

            if (this.post?.comments) {
              removeCommentRecursively(this.post.comments);
            }
            this.toastService.showToast('Comment deleted successfully', 'success');
            this.cdr.markForCheck();
          },
          error: (error) => {
            console.error('Error deleting comment:', error);
            this.toastService.showToast('Error deleting comment', 'error');
          }
        });
      }
    });
  }

  goToAuthorProfile(): void {
    if (this.post?.author?.id) {
      this.router.navigate(['/profile', this.post.author.id]);
    }
  }

  toggleFollow(): void {
    if (!this.post?.author?.id) return;
    
    // If already following, show confirmation dialog
    if (this.isFollowing) {
      Swal.fire({
        title: 'Unfollow',
        text: `Are you sure you want to unfollow ${this.post.author.username}?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, unfollow'
      }).then((result) => {
        if (result.isConfirmed) {
          this.performToggleFollow();
        }
      });
    } else {
      // If not following, follow immediately without confirmation
      this.performToggleFollow();
    }
  }

  private performToggleFollow(): void {
    const previousState = this.isFollowing;
    
    this.dataService.toggleFollow(this.post.author.id).subscribe({
      next: (response) => {
        if (response && response.payload && typeof response.payload.following === 'boolean') {
          this.isFollowing = response.payload.following;
          // Update follower count
          if (this.post.author) {
            this.post.author.followers = response.payload.following ? 
              (this.post.author.followers || 0) + 1 : 
              (this.post.author.followers || 1) - 1;
          }
          this.cdr.markForCheck();
          
          // Show success message
          this.toastService.showToast(
            `Successfully ${response.payload.following ? 'followed' : 'unfollowed'} ${this.post.author.username}`,
            'success'
          );
        }
      },
      error: (error) => {
        // Revert to previous state on error
        this.isFollowing = previousState;
        this.cdr.markForCheck();
        console.error('Error toggling follow:', error);
        this.toastService.showToast('Failed to update follow status', 'error');
      }
    });
  }

  goBack(): void {
    window.history.back();
  }

  ngOnDestroy() {
    if (this.notificationSubscription) {
      this.notificationSubscription.unsubscribe();
    }
  }
}
