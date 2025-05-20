import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DataService } from '../../../services/data.service';
import { TimeAgoPipe } from '../../../utils/time-ago.pipe';
import { ToastService } from '../../../services/toast.service';
import Swal from 'sweetalert2';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-listing-details',
  standalone: true,
  imports: [CommonModule, TimeAgoPipe, FormsModule],
  templateUrl: './listing-details.component.html',
  styleUrls: ['./listing-details.component.css']
})
export class ListingDetailsComponent implements OnInit {
  listing: any;
  currentUser: any;
  currentMediaIndex = 0;
  loading = true;
  error: string | null = null;
  
  // Add properties for conversation handling
  existingConversation: any = null;
  showContactForm = false;
  messageText = '';
  sendingMessage = false;

  // Add a new property to control the action menu visibility
  showActionMenu = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dataService: DataService,
    private toastService: ToastService
  ) {
    this.currentUser = this.dataService.getCurrentUser();
  }

  ngOnInit(): void {
    const listingId = this.route.snapshot.paramMap.get('id');
    if (listingId) {
      this.dataService.getListingById(listingId).subscribe({
        next: (response) => {
          this.listing = response.payload;
          this.loading = false;
          
          // If user is logged in and not the author, check for existing conversations
          if (this.currentUser && this.currentUser.id !== this.listing.author.id) {
            this.checkExistingConversation();
          }
        },
        error: (error) => {
          console.error('Error fetching listing:', error);
          this.error = 'Failed to load listing details.';
          this.loading = false;
        }
      });
    }
  }

  // Check if there's an existing conversation for this listing
  checkExistingConversation(): void {
    this.dataService.getConversations().subscribe({
      next: (response) => {
        if (response && response.payload) {
          // Find conversations with this seller that mention this listing
          this.existingConversation = response.payload.find((conv: any) => 
            conv.otherUser?.id === this.listing.author.id && 
            conv.listingId === this.listing.id
          );
        }
      },
      error: (error) => {
        console.error('Error checking conversations:', error);
      }
    });
  }

  // Toggle contact form visibility
  toggleContactForm(): void {
    this.showContactForm = !this.showContactForm;
  }

  // Update the sendMessage method to pass the conversation ID
  sendMessage(): void {
    if (!this.messageText.trim()) {
      return;
    }

    this.sendingMessage = true;
    
    // First create/get conversation
    this.dataService.createConversation(this.listing.author.id, this.listing.id).subscribe({
      next: (response) => {
        const conversation = response.payload;
        const conversationId = conversation.id;
        
        // Add listing context to the message
        const messageText = `[Re: ${this.listing.title}] ${this.messageText}`;
        
        // Pass the conversation ID to ensure message goes to the right conversation
        this.dataService.sendMessage(this.listing.author.id, messageText, conversationId).subscribe({
          next: () => {
            this.toastService.showToast('Message sent successfully', 'success');
            this.messageText = '';
            this.showContactForm = false;
            this.sendingMessage = false;
            this.existingConversation = conversation;
          },
          error: (error) => {
            console.error('Error sending message:', error);
            this.toastService.showToast('Failed to send message', 'error');
            this.sendingMessage = false;
          }
        });
      },
      error: (error) => {
        console.error('Error creating conversation:', error);
        this.toastService.showToast('Failed to create conversation', 'error');
        this.sendingMessage = false;
      }
    });
  }

  // View existing conversation
  viewConversation(): void {
    if (this.existingConversation) {
      this.router.navigate(['/inbox'], { 
        queryParams: { 
          tab: 'messages',
          conversationId: this.existingConversation.id 
        } 
      });
    }
  }

  // Toggle action menu visibility
  toggleActionMenu(): void {
    this.showActionMenu = !this.showActionMenu;
  }

  // Edit listing method
  editListing(): void {
    this.router.navigate(['/edit-listing', this.listing.id]);
    this.showActionMenu = false;
  }

  // Update the existing deleteListing() method to close the dropdown after clicking
  deleteListing(): void {
    if (this.currentUser.id !== this.listing.author.id) return;
    
    this.showActionMenu = false; // Close dropdown immediately
    
    Swal.fire({
      title: 'Delete Listing',
      text: 'Are you sure you want to delete this listing?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
      if (result.isConfirmed) {
        this.dataService.deleteListing(this.listing.id).subscribe({
          next: () => {
            this.toastService.showToast('Listing deleted successfully', 'success');
            this.router.navigate(['/listings']);
          },
          error: (error) => {
            console.error('Error deleting listing:', error);
            this.toastService.showToast('Failed to delete listing', 'error');
          }
        });
      }
    });
  }

  // Original methods remain the same...
  previousMedia(): void {
    if (this.currentMediaIndex > 0) {
      this.currentMediaIndex--;
    }
  }

  nextMedia(): void {
    if (this.currentMediaIndex < (this.listing?.media?.length || 0) - 1) {
      this.currentMediaIndex++;
    }
  }

  messageUser(): void {
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    // Create a conversation with the listing owner
    this.dataService.createConversation(this.listing.author.id, this.listing.id).subscribe({
      next: (response) => {
        this.router.navigate(['/inbox'], { 
          queryParams: { 
            tab: 'messages',
            conversationId: response.payload.id 
          } 
        });
      },
      error: (error) => {
        console.error('Error creating conversation:', error);
        this.toastService.showToast('Failed to start conversation', 'error');
      }
    });
  }

  goToAuthorProfile(): void {
    if (this.listing?.author?.id) {
      this.router.navigate(['/profile', this.listing.author.id]);
    }
  }

  goBack(): void {
    this.router.navigate(['/listings']);
  }
}