export const validateUsernameFrontend = (username: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const regex = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,28}[a-zA-Z0-9]$/;

    if (!username || username.length < 3 || username.length > 30) {
        errors.push('Username must be between 3 and 30 characters.');
    }
    if (!regex.test(username)) {
        errors.push('Username must start and end with a letter or number, and can only contain letters, numbers, underscores, hyphens, or single periods.');
    }
    if (/([._-])\1/.test(username)) {
        errors.push('Username cannot contain consecutive underscores, hyphens, or periods.');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

export const validatePasswordFrontend = (password: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!password || password.length < 8) {
        errors.push('Password must be at least 8 characters.');
    }
    if (!/^[^\s].*[^\s]$/.test(password)) {
        errors.push('Password cannot start or end with a space.');
    }
    if (!/[A-Za-z]/.test(password)) {
        errors.push('Password must contain at least one letter.');
    }
    if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number.');
    }
    if (!/[@$!%*?&]/.test(password)) {
        errors.push('Password must contain at least one special character (@$!%*?&).');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

export const validateEmailFrontend = (email: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !emailRegex.test(email)) {
        errors.push('Please enter a valid email address.');
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};