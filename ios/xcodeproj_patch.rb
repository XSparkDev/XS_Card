# Monkey patch to add support for Xcode 16.4 (object version 70)
# This patch must be loaded after xcodeproj is required

# Ensure xcodeproj is loaded
begin
  require 'xcodeproj'
rescue LoadError
  # Will be loaded by CocoaPods later
end

# Patch the compatibility version hash when available
if defined?(Xcodeproj) && defined?(Xcodeproj::Constants)
  # Unfreeze and add version 70 support for Xcode 16.4
  hash = Xcodeproj::Constants::COMPATIBILITY_VERSION_BY_OBJECT_VERSION.dup
  hash[70] = 'Xcode 16.4'
  Xcodeproj::Constants.send(:remove_const, :COMPATIBILITY_VERSION_BY_OBJECT_VERSION)
  Xcodeproj::Constants.const_set(:COMPATIBILITY_VERSION_BY_OBJECT_VERSION, hash.freeze)
end

