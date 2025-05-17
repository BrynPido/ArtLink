import { User } from './user.js';
import { Media } from './media.js';

export interface ListingDetails {
  price: number;
  category: string;
  condition: string;
  location: string;
}

export interface Listing {
  id: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  published: boolean;
  authorId: number;
  author: User;
  media: Media[];
  listingDetails: ListingDetails;
}