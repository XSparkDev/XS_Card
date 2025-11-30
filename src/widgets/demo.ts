import { 
  WidgetManager, 
  WidgetConfigManager, 
  WidgetSize, 
  WidgetDisplayMode, 
  WidgetTheme, 
  WidgetUpdateFrequency,
  widgetConfigUtils,
  DEFAULT_WIDGET_CONFIG
} from './index';

/**
 * Demo function to test the widget system
 */
export async function testWidgetSystem() {
  console.log('🧪 Testing Widget System...\n');

  try {
    // 1. Test Widget Configuration Manager
    console.log('1️⃣ Testing Widget Configuration Manager...');
    const configManager = WidgetConfigManager.getInstance();
    await configManager.initialize();
    console.log('✅ Widget Configuration Manager initialized');

    // 2. Test creating widget configurations
    console.log('\n2️⃣ Testing Widget Configuration Creation...');
    
    // Test minimal config
    const minimalConfig = widgetConfigUtils.createMinimalConfig(0, '#FF5733');
    console.log('✅ Minimal config created:', {
      size: minimalConfig.size,
      displayMode: minimalConfig.displayMode,
      theme: minimalConfig.theme
    });

    // Test full config
    const fullConfig = widgetConfigUtils.createFullConfig(1, '#33FF57');
    console.log('✅ Full config created:', {
      size: fullConfig.size,
      displayMode: fullConfig.displayMode,
      theme: fullConfig.theme
    });

    // Test recommended config
    const recommendedConfig = widgetConfigUtils.getRecommendedConfig(2, true, true, true);
    console.log('✅ Recommended config created:', {
      size: recommendedConfig.size,
      displayMode: recommendedConfig.displayMode
    });

    // 3. Test Widget Manager
    console.log('\n3️⃣ Testing Widget Manager...');
    const widgetManager = WidgetManager.getInstance();
    await widgetManager.initialize();
    console.log('✅ Widget Manager initialized');

    // 4. Test widget creation
    console.log('\n4️⃣ Testing Widget Creation...');
    const mockCardData = {
      id: 'demo-card-1',
      name: 'John',
      surname: 'Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      company: 'Demo Company',
      occupation: 'Developer',
      profileImage: 'profile.jpg',
      companyLogo: 'logo.png',
      colorScheme: '#1B2B5B',
      logoZoomLevel: 1.2,
      socials: {
        linkedin: 'linkedin.com/in/johndoe',
        twitter: 'twitter.com/johndoe'
      }
    };

    const widgetData = await widgetManager.createWidget(0, mockCardData);
    console.log('✅ Widget created for card 0:', {
      name: widgetData.name,
      company: widgetData.company,
      colorScheme: widgetData.colorScheme
    });

    // 5. Test widget data retrieval
    console.log('\n5️⃣ Testing Widget Data Retrieval...');
    const retrievedData = await widgetManager.getWidgetData(0);
    if (retrievedData) {
      console.log('✅ Widget data retrieved:', {
        name: retrievedData.name,
        company: retrievedData.company
      });
    }

    // 6. Test widget configuration retrieval
    console.log('\n6️⃣ Testing Widget Configuration Retrieval...');
    const widgetConfig = await configManager.getWidgetConfig(0);
    if (widgetConfig) {
      console.log('✅ Widget config retrieved:', {
        id: widgetConfig.id,
        size: widgetConfig.size,
        displayMode: widgetConfig.displayMode,
        theme: widgetConfig.theme
      });
    }

    // 7. Test widget preferences
    console.log('\n7️⃣ Testing Widget Preferences...');
    const preferences = await widgetManager.getWidgetPreferences();
    console.log('✅ Widget preferences retrieved:', {
      globalEnabled: preferences.globalEnabled,
      defaultSize: preferences.defaultSize,
      defaultTheme: preferences.defaultTheme
    });

    // 8. Test analytics
    console.log('\n8️⃣ Testing Widget Analytics...');
    if (widgetConfig) {
      await widgetManager.recordInteraction(widgetConfig.id, 'view');
      await widgetManager.recordInteraction(widgetConfig.id, 'tap');
      console.log('✅ Widget interactions recorded');
    }

    // 9. Test export functionality
    console.log('\n9️⃣ Testing Export Functionality...');
    const exportData = await widgetManager.exportWidgetData();
    console.log('✅ Widget data exported, length:', exportData.length);

    console.log('\n🎉 All Widget System Tests Passed!');
    return true;

  } catch (error) {
    console.error('❌ Widget System Test Failed:', error);
    return false;
  }
}

/**
 * Test specific widget types and enums
 */
export function testWidgetTypes() {
  console.log('🧪 Testing Widget Types...\n');

  // Test enum values
  console.log('Widget Sizes:', [WidgetSize.SMALL, WidgetSize.LARGE]);
  console.log('Display Modes:', [WidgetDisplayMode.QR_CODE, WidgetDisplayMode.CARD_INFO, WidgetDisplayMode.HYBRID, WidgetDisplayMode.MINIMAL]);
  console.log('Themes:', [WidgetTheme.LIGHT, WidgetTheme.DARK, WidgetTheme.AUTO, WidgetTheme.CUSTOM]);
  console.log('Update Frequencies:', [WidgetUpdateFrequency.NEVER, WidgetUpdateFrequency.HOURLY, WidgetUpdateFrequency.DAILY, WidgetUpdateFrequency.WEEKLY, WidgetUpdateFrequency.ON_CHANGE]);

  // Test default config
  console.log('\nDefault Widget Config:', {
    size: DEFAULT_WIDGET_CONFIG.size,
    displayMode: DEFAULT_WIDGET_CONFIG.displayMode,
    theme: DEFAULT_WIDGET_CONFIG.theme,
    updateFrequency: DEFAULT_WIDGET_CONFIG.updateFrequency
  });

  console.log('\n✅ Widget Types Test Completed!');
}

/**
 * Run all tests
 */
export async function runAllTests() {
  console.log('🚀 Starting Widget System Tests...\n');
  
  testWidgetTypes();
  console.log('\n' + '='.repeat(50) + '\n');
  
  const success = await testWidgetSystem();
  
  if (success) {
    console.log('\n🎊 All tests completed successfully!');
  } else {
    console.log('\n💥 Some tests failed. Check the logs above.');
  }
  
  return success;
}

// Export for use in other files
export default {
  testWidgetSystem,
  testWidgetTypes,
  runAllTests
};
