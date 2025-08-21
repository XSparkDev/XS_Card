import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import { QuantitySelectorProps } from '../../types/bulkRegistration';
import { formatCurrency, validateQuantity } from '../../utils/bulkRegistrationUtils';

const QuantitySelector: React.FC<QuantitySelectorProps> = ({
  quantity,
  onQuantityChange,
  minQuantity = 2,
  maxQuantity = 50,
  ticketPrice,
  eventCapacity,
  currentRegistrations = 0,
}) => {
  const animatedValue = React.useRef(new Animated.Value(quantity)).current;

  React.useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: quantity,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
  }, [quantity]);

  const handleIncrement = () => {
    const newQuantity = Math.min(quantity + 1, maxQuantity);
    
    // Check capacity if available
    if (eventCapacity && currentRegistrations !== undefined) {
      const availableSpots = eventCapacity - currentRegistrations;
      if (newQuantity > availableSpots) {
        return; // Don't increment if it would exceed capacity
      }
    }
    
    onQuantityChange(newQuantity);
  };

  const handleDecrement = () => {
    const newQuantity = Math.max(quantity - 1, minQuantity);
    onQuantityChange(newQuantity);
  };

  const totalCost = ticketPrice * quantity;
  const quantityValidation = validateQuantity(quantity, eventCapacity, currentRegistrations);
  const availableSpots = eventCapacity ? eventCapacity - currentRegistrations : undefined;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Number of Tickets</Text>
        <Text style={styles.subtitle}>
          Choose how many people you want to register
        </Text>
      </View>

      <View style={styles.quantityContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            styles.decrementButton,
            quantity <= minQuantity && styles.buttonDisabled
          ]}
          onPress={handleDecrement}
          disabled={quantity <= minQuantity}
        >
          <MaterialIcons 
            name="remove" 
            size={24} 
            color={quantity <= minQuantity ? COLORS.gray : COLORS.white} 
          />
        </TouchableOpacity>

        <View style={styles.quantityDisplay}>
          <Text style={styles.quantityText}>{quantity}</Text>
          <Text style={styles.quantityLabel}>tickets</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.button,
            styles.incrementButton,
            (quantity >= maxQuantity || (availableSpots !== undefined && quantity >= availableSpots)) && styles.buttonDisabled
          ]}
          onPress={handleIncrement}
          disabled={
            quantity >= maxQuantity || 
            (availableSpots !== undefined && quantity >= availableSpots)
          }
        >
          <MaterialIcons 
            name="add" 
            size={24} 
            color={
              quantity >= maxQuantity || 
              (availableSpots !== undefined && quantity >= availableSpots)
                ? COLORS.gray 
                : COLORS.white
            } 
          />
        </TouchableOpacity>
      </View>

      <View style={styles.costContainer}>
        <Text style={styles.costLabel}>Total Cost:</Text>
        <Text style={styles.costAmount}>{formatCurrency(totalCost)}</Text>
      </View>

      {availableSpots !== undefined && (
        <View style={styles.capacityInfo}>
          <MaterialIcons name="info" size={16} color={COLORS.primary} />
          <Text style={styles.capacityText}>
            {availableSpots} spots available for this event
          </Text>
        </View>
      )}

      {!quantityValidation.valid && (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error" size={16} color={COLORS.error} />
          <Text style={styles.errorText}>{quantityValidation.errors[0]}</Text>
        </View>
      )}

      <View style={styles.infoContainer}>
        <MaterialIcons name="info" size={16} color={COLORS.gray} />
        <Text style={styles.infoText}>
          Bulk registration allows you to register 2-50 people at once. 
          Each person will receive their own ticket with a unique QR code.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 20,
    marginVertical: 8,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.black,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.lightGray,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  button: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  decrementButton: {
    backgroundColor: COLORS.secondary,
  },
  incrementButton: {
    backgroundColor: COLORS.primary,
  },
  buttonDisabled: {
    backgroundColor: COLORS.lightGray,
    shadowOpacity: 0,
    elevation: 0,
  },
  quantityDisplay: {
    alignItems: 'center',
    flex: 1,
  },
  quantityText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.black,
  },
  quantityLabel: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
  costContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  costLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
  },
  costAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  capacityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  capacityText: {
    fontSize: 14,
    color: COLORS.primary,
    marginLeft: 8,
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.errorLight,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.error,
    marginLeft: 8,
    flex: 1,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.lightGray,
    padding: 12,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.gray,
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
});

export default QuantitySelector; 