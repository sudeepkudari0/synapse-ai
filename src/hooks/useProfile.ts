import { useEffect, useCallback } from 'react';
import { useProfileStore, UserProfile } from '../state';

export function useProfile() {
    const { profile, isProfileLoaded, loadProfile, updateProfile } = useProfileStore();

    // Load profile from IPC on mount
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await window.electronAPI.profile.load();
                if (response.success && response.profile) {
                    loadProfile(response.profile);
                }
            } catch (error) {
                console.error('Failed to load profile from IPC:', error);
            }
        };

        if (!isProfileLoaded) {
            fetchProfile();
        }
    }, [isProfileLoaded, loadProfile]);

    const saveProfile = useCallback(async (updates: Partial<UserProfile>) => {
        const newProfile = { ...profile, ...updates };
        
        // Update local state first for immediate UI feedback
        updateProfile(updates);

        try {
            const response = await window.electronAPI.profile.save(newProfile);
            if (!response.success) {
                console.error('Failed to save profile:', response.error);
                // In a real app, we might revert state here or show an error toast
            }
            return response.success;
        } catch (error) {
            console.error('Failed to save profile via IPC:', error);
            return false;
        }
    }, [profile, updateProfile]);

    return {
        profile,
        isProfileLoaded,
        saveProfile,
    };
}
