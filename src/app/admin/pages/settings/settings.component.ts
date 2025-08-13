import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { SweetAlertService } from '../../services/sweetalert.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  loading = false;
  saving = false;
  settings: any = {
    general: {
      siteName: 'ArtLink',
      siteDescription: 'A platform for artists to connect and share their work',
      language: 'en',
      maintenanceMode: false,
      registrationEnabled: true,
      allowGuestViewing: true
    },
    content: {
      maxFileSize: '10MB',
      allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
      autoModeration: false,
      requirePostApproval: false,
      requireListingApproval: false,
      maxPostsPerDay: 10
    },
    security: {
      passwordMinLength: 8,
      requireEmailVerification: true,
      sessionTimeout: 30,
      maxLoginAttempts: 5,
      enableBruteForceProtection: true
    }
  };
  originalSettings: any = {};
  
  settingsCategories = [
    {
      id: 'general',
      name: 'General Settings',
      icon: 'cog',
      active: true
    },
    {
      id: 'security',
      name: 'Security',
      icon: 'shield',
      active: false
    },
    {
      id: 'content',
      name: 'Content Management',
      icon: 'document',
      active: false
    }
  ];

  activeCategory = 'general';

  constructor(
    private adminService: AdminService,
    private sweetAlert: SweetAlertService
  ) {}

  ngOnInit() {
    this.loadSettings();
  }

  loadSettings() {
    this.loading = true;
    this.adminService.getSystemSettings().subscribe({
      next: (response: any) => {
        // Handle the API response structure
        if (response.status === 'success' && response.data) {
          this.settings = response.data;
        } else {
          this.settings = response || this.getDefaultSettings();
        }
        this.originalSettings = JSON.parse(JSON.stringify(this.settings));
        this.loading = false;
      },
      error: (error: any) => {
        console.error('Error loading settings:', error);
        this.sweetAlert.error('Error', 'Failed to load settings');
        this.settings = this.getDefaultSettings();
        this.originalSettings = JSON.parse(JSON.stringify(this.settings));
        this.loading = false;
      }
    });
  }

  getDefaultSettings() {
    return {
      general: {
        siteName: 'ArtLink',
        siteDescription: 'A platform for artists to connect and showcase their work',
        timezone: 'UTC',
        language: 'en',
        maintenanceMode: false,
        allowRegistration: true,
        requireEmailVerification: true
      },
      security: {
        sessionTimeout: 3600,
        maxLoginAttempts: 5,
        lockoutDuration: 900,
        passwordMinLength: 8,
        requireSpecialCharacters: true,
        enableTwoFactor: false,
        ipWhitelist: []
      },
      email: {
        provider: 'smtp',
        smtpHost: '',
        smtpPort: 587,
        smtpUser: '',
        smtpPassword: '',
        fromEmail: '',
        fromName: 'ArtLink',
        enableSSL: true
      },
      storage: {
        maxFileSize: 10,
        allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        storageProvider: 'local',
        cloudinaryUrl: '',
        awsAccessKey: '',
        awsSecretKey: '',
        awsBucket: '',
        compressionQuality: 85
      },
      notifications: {
        enableEmailNotifications: true,
        enablePushNotifications: false,
        newUserNotification: true,
        newPostNotification: false,
        newListingNotification: true,
        flaggedContentNotification: true,
        systemAlerts: true
      }
    };
  }

  selectCategory(categoryId: string) {
    this.settingsCategories.forEach(cat => cat.active = cat.id === categoryId);
    this.activeCategory = categoryId;
  }

  saveSettings() {
    this.saving = true;
    
    this.adminService.updateSystemSettings(this.settings).subscribe({
      next: () => {
        this.originalSettings = JSON.parse(JSON.stringify(this.settings));
        this.saving = false;
        this.sweetAlert.success('Success!', 'Settings saved successfully!');
      },
      error: (error: any) => {
        console.error('Error saving settings:', error);
        this.saving = false;
        this.sweetAlert.error('Error', 'Error saving settings. Please try again.');
      }
    });
  }

  resetSettings() {
    this.sweetAlert.confirm(
      'Reset Settings',
      'Are you sure you want to reset all settings to default values? This action cannot be undone.',
      'Yes, reset'
    ).then((result) => {
      if (result.isConfirmed) {
        this.settings = this.getDefaultSettings();
        this.sweetAlert.success('Reset Complete', 'Settings have been reset to default values.');
      }
    });
  }

  discardChanges() {
    this.sweetAlert.confirm(
      'Discard Changes',
      'Are you sure you want to discard all unsaved changes?',
      'Yes, discard'
    ).then((result) => {
      if (result.isConfirmed) {
        this.settings = JSON.parse(JSON.stringify(this.originalSettings));
        this.sweetAlert.info('Changes Discarded', 'All unsaved changes have been discarded.');
      }
    });
  }

  hasUnsavedChanges(): boolean {
    return JSON.stringify(this.settings) !== JSON.stringify(this.originalSettings);
  }

  testEmailConfiguration() {
    if (!this.settings.email.smtpHost || !this.settings.email.smtpUser) {
      this.sweetAlert.warning('Missing Configuration', 'Please fill in the SMTP configuration first.');
      return;
    }

    // In a real implementation, this would call an API endpoint to test email
    this.sweetAlert.info('Test Email', 'Email configuration test sent to API (feature not implemented in demo)');
  }

  addIpToWhitelist() {
    this.sweetAlert.input('Add IP to Whitelist', 'Enter IP address to whitelist:', 'text')
      .then((result) => {
        if (result.isConfirmed && result.value) {
          const ip = result.value;
          if (ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
            if (!this.settings.security.ipWhitelist.includes(ip)) {
              this.settings.security.ipWhitelist.push(ip);
              this.sweetAlert.success('Added!', `IP address ${ip} has been added to the whitelist.`);
            } else {
              this.sweetAlert.warning('Already Exists', 'This IP address is already in the whitelist.');
            }
          } else {
            this.sweetAlert.error('Invalid IP', 'Please enter a valid IP address.');
          }
        }
      });
  }

  removeIpFromWhitelist(ip: string) {
    const index = this.settings.security.ipWhitelist.indexOf(ip);
    if (index > -1) {
      this.settings.security.ipWhitelist.splice(index, 1);
    }
  }

  addFileType() {
    const fileType = prompt('Enter file extension (without dot):');
    if (fileType && !this.settings.storage.allowedFileTypes.includes(fileType.toLowerCase())) {
      this.settings.storage.allowedFileTypes.push(fileType.toLowerCase());
    }
  }

  removeFileType(fileType: string) {
    const index = this.settings.storage.allowedFileTypes.indexOf(fileType);
    if (index > -1) {
      this.settings.storage.allowedFileTypes.splice(index, 1);
    }
  }

  exportSettings() {
    const settingsJson = JSON.stringify(this.settings, null, 2);
    const blob = new Blob([settingsJson], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'artlink-settings.json';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  importSettings(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedSettings = JSON.parse(e.target?.result as string);
        this.sweetAlert.confirm(
          'Import Settings',
          'Are you sure you want to import these settings? This will overwrite current settings.',
          'Yes, import'
        ).then((result) => {
          if (result.isConfirmed) {
            this.settings = { ...this.getDefaultSettings(), ...importedSettings };
            this.sweetAlert.success('Imported!', 'Settings have been imported successfully.');
          }
        });
      } catch (error) {
        this.sweetAlert.error('Invalid File', 'Invalid settings file. Please check the format and try again.');
      }
    };
    reader.readAsText(file);
  }

  toggleFileType(type: string, event: any) {
    const isChecked = event.target.checked;
    if (isChecked) {
      if (!this.settings.content.allowedFileTypes.includes(type)) {
        this.settings.content.allowedFileTypes.push(type);
      }
    } else {
      const index = this.settings.content.allowedFileTypes.indexOf(type);
      if (index > -1) {
        this.settings.content.allowedFileTypes.splice(index, 1);
      }
    }
  }

  getCategoryIcon(iconName: string): string {
    const icons: { [key: string]: string } = {
      cog: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      shield: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      document: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      mail: 'M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      database: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
      bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
    };
    return icons[iconName] || icons['cog'];
  }
}
