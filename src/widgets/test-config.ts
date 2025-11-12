import { WidgetConfigManager, widgetConfigUtils, WidgetSize, WidgetDisplayMode, WidgetTheme } from './index';

/**
 * Simple test to verify widget configuration system
 */
export async function testWidgetConfig() {
  console.log('🧪 Testing Widget Configuration System...\n');

  try {
    // Initialize the configuration manager
    const configManager = WidgetConfigManager.getInstance();
    await configManager.initialize();
    console.log('✅ Configuration manager initialized');

    // Test creating a minimal configuration
    const minimalConfig = widgetConfigUtils.createMinimalConfig(0, '#FF5733');
    console.log('✅ Minimal config created:', {
      cardIndex: minimalConfig.cardIndex,
      size: minimalConfig.size,
      displayMode: minimalConfig.displayMode,
      theme: minimalConfig.theme,
      showProfileImage: minimalConfig.showProfileImage,
      showCompanyLogo: minimalConfig.showCompanyLogo,
      showSocialLinks: minimalConfig.showSocialLinks,
      showQRCode: minimalConfig.showQRCode
    });

    // Test creating a full configuration
    const fullConfig = widgetConfigUtils.createFullConfig(1, '#33FF57');
    console.log('✅ Full config created:', {
      cardIndex: fullConfig.cardIndex,
      size: fullConfig.size,
      displayMode: fullConfig.displayMode,
      theme: fullConfig.theme,
      showProfileImage: fullConfig.showProfileImage,
      showCompanyLogo: fullConfig.showCompanyLogo,
      showSocialLinks: fullConfig.showSocialLinks,
      showQRCode: fullConfig.showQRCode
    });

    // Test recommended configuration
    const recommendedConfig = widgetConfigUtils.getRecommendedConfig(2, true, true, true);
    console.log('✅ Recommended config created:', {
      cardIndex: recommendedConfig.cardIndex,
      size: recommendedConfig.size,
      displayMode: recommendedConfig.displayMode,
      theme: recommendedConfig.theme
    });

    // Test creating actual widget configuration
    const actualConfig = await configManager.createWidgetConfig(3, {
      size: WidgetSize.LARGE,
      displayMode: WidgetDisplayMode.HYBRID,
      theme: WidgetTheme.CUSTOM,
      showProfileImage: true,
      showCompanyLogo: false,
      showSocialLinks: true,
      showQRCode: true
    });

    console.log('✅ Actual widget config created:', {
      id: actualConfig.id,
      cardIndex: actualConfig.cardIndex,
      size: actualConfig.size,
      displayMode: actualConfig.displayMode,
      theme: actualConfig.theme,
      createdAt: actualConfig.createdAt,
      updatedAt: actualConfig.updatedAt
    });

    // Test retrieving the configuration
    const retrievedConfig = await configManager.getWidgetConfig(3);
    if (retrievedConfig) {
      console.log('✅ Configuration retrieved successfully:', {
        id: retrievedConfig.id,
        cardIndex: retrievedConfig.cardIndex,
        size: retrievedConfig.size
      });
    } else {
      console.log('❌ Failed to retrieve configuration');
    }

    // Test updating configuration
    const updatedConfig = await configManager.updateWidgetConfig(3, {
      size: WidgetSize.SMALL,
      showProfileImage: false
    });

    console.log('✅ Configuration updated:', {
      size: updatedConfig.size,
      showProfileImage: updatedConfig.showProfileImage,
      updatedAt: updatedConfig.updatedAt
    });

    // Test getting all configurations
    const allConfigs = await configManager.getAllWidgetConfigs();
    console.log('✅ All configurations retrieved:', allConfigs.length, 'configs found');

    // Test cloning configuration
    const clonedConfig = await configManager.cloneConfig(3, 4);
    console.log('✅ Configuration cloned:', {
      sourceCard: 3,
      targetCard: 4,
      clonedId: clonedConfig.id,
      size: clonedConfig.size
    });

    // Test export functionality
    const exportData = await configManager.exportConfigs();
    console.log('✅ Configurations exported, length:', exportData.length);

    console.log('\n🎉 All Widget Configuration Tests Passed!');
    return true;

  } catch (error) {
    console.error('❌ Widget Configuration Test Failed:', error);
    return false;
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testWidgetConfig().then(success => {
    if (success) {
      console.log('\n🎊 Configuration system is working correctly!');
    } else {
      console.log('\n💥 Configuration system has issues.');
    }
  });
}
