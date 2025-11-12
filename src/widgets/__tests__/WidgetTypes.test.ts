import {
  WidgetSize,
  WidgetDisplayMode,
  WidgetTheme,
  WidgetUpdateFrequency,
  isWidgetSize,
  isWidgetDisplayMode,
  isWidgetTheme,
  isWidgetUpdateFrequency,
  isWidgetConfig,
  isWidgetData
} from '../WidgetTypes';

describe('Widget Types', () => {
  describe('Enums', () => {
    it('should have valid WidgetSize values', () => {
      expect(WidgetSize.SMALL).toBe('small');
      expect(WidgetSize.MEDIUM).toBe('medium');
      expect(WidgetSize.LARGE).toBe('large');
      expect(WidgetSize.EXTRA_LARGE).toBe('xl');
    });

    it('should have valid WidgetDisplayMode values', () => {
      expect(WidgetDisplayMode.QR_CODE).toBe('qr_code');
      expect(WidgetDisplayMode.CARD_INFO).toBe('card_info');
      expect(WidgetDisplayMode.HYBRID).toBe('hybrid');
      expect(WidgetDisplayMode.MINIMAL).toBe('minimal');
    });

    it('should have valid WidgetTheme values', () => {
      expect(WidgetTheme.LIGHT).toBe('light');
      expect(WidgetTheme.DARK).toBe('dark');
      expect(WidgetTheme.AUTO).toBe('auto');
      expect(WidgetTheme.CUSTOM).toBe('custom');
    });

    it('should have valid WidgetUpdateFrequency values', () => {
      expect(WidgetUpdateFrequency.NEVER).toBe('never');
      expect(WidgetUpdateFrequency.HOURLY).toBe('hourly');
      expect(WidgetUpdateFrequency.DAILY).toBe('daily');
      expect(WidgetUpdateFrequency.WEEKLY).toBe('weekly');
      expect(WidgetUpdateFrequency.ON_CHANGE).toBe('on_change');
    });
  });

  describe('Type Guards', () => {
    it('should validate WidgetSize correctly', () => {
      expect(isWidgetSize('small')).toBe(true);
      expect(isWidgetSize('medium')).toBe(true);
      expect(isWidgetSize('large')).toBe(true);
      expect(isWidgetSize('xl')).toBe(true);
      expect(isWidgetSize('invalid')).toBe(false);
      expect(isWidgetSize(123)).toBe(false);
      expect(isWidgetSize(null)).toBe(false);
    });

    it('should validate WidgetDisplayMode correctly', () => {
      expect(isWidgetDisplayMode('qr_code')).toBe(true);
      expect(isWidgetDisplayMode('card_info')).toBe(true);
      expect(isWidgetDisplayMode('hybrid')).toBe(true);
      expect(isWidgetDisplayMode('minimal')).toBe(true);
      expect(isWidgetDisplayMode('invalid')).toBe(false);
      expect(isWidgetDisplayMode(123)).toBe(false);
    });

    it('should validate WidgetTheme correctly', () => {
      expect(isWidgetTheme('light')).toBe(true);
      expect(isWidgetTheme('dark')).toBe(true);
      expect(isWidgetTheme('auto')).toBe(true);
      expect(isWidgetTheme('custom')).toBe(true);
      expect(isWidgetTheme('invalid')).toBe(false);
      expect(isWidgetTheme(123)).toBe(false);
    });

    it('should validate WidgetUpdateFrequency correctly', () => {
      expect(isWidgetUpdateFrequency('never')).toBe(true);
      expect(isWidgetUpdateFrequency('hourly')).toBe(true);
      expect(isWidgetUpdateFrequency('daily')).toBe(true);
      expect(isWidgetUpdateFrequency('weekly')).toBe(true);
      expect(isWidgetUpdateFrequency('on_change')).toBe(true);
      expect(isWidgetUpdateFrequency('invalid')).toBe(false);
      expect(isWidgetUpdateFrequency(123)).toBe(false);
    });

    it('should validate WidgetConfig correctly', () => {
      const validConfig = {
        id: 'test-id',
        cardIndex: 0,
        size: WidgetSize.MEDIUM,
        displayMode: WidgetDisplayMode.HYBRID,
        theme: WidgetTheme.CUSTOM,
        updateFrequency: WidgetUpdateFrequency.DAILY,
        showProfileImage: true,
        showCompanyLogo: true,
        showSocialLinks: true,
        showQRCode: true,
        borderRadius: 12,
        tapToShare: true,
        longPressToEdit: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true
      };

      expect(isWidgetConfig(validConfig)).toBe(true);
      expect(isWidgetConfig({ ...validConfig, size: 'invalid' })).toBe(false);
      expect(isWidgetConfig({ ...validConfig, id: undefined })).toBe(false);
      expect(isWidgetConfig(null)).toBe(false);
      expect(isWidgetConfig({})).toBe(false);
    });

    it('should validate WidgetData correctly', () => {
      const validData = {
        cardIndex: 0,
        cardId: 'test-card',
        name: 'John',
        surname: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        company: 'Test Company',
        occupation: 'Developer',
        colorScheme: '#1B2B5B',
        socials: {},
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      };

      expect(isWidgetData(validData)).toBe(true);
      expect(isWidgetData({ ...validData, name: undefined })).toBe(false);
      expect(isWidgetData({ ...validData, cardIndex: 'invalid' })).toBe(false);
      expect(isWidgetData(null)).toBe(false);
      expect(isWidgetData({})).toBe(false);
    });
  });
});
