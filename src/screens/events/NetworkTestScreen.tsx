import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { API_BASE_URL } from '../../utils/api';
import { useToast } from '../../hooks/useToast';

export default function NetworkTestScreen() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState('');
  const toast = useToast();

  const testConnection = async () => {
    setTesting(true);
    setResult('Testing...');

    try {
      console.log('Testing connection to:', `${API_BASE_URL}/events/public?limit=1`);
      
      const response = await fetch(`${API_BASE_URL}/events/public?limit=1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Response data:', data);

      setResult(`✅ Success! Received ${data.data?.events?.length || 0} events`);
      toast.success('Success', 'Network connection is working!');
    } catch (error) {
      console.error('Network test error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setResult(`❌ Error: ${errorMessage}`);
      toast.error('Network Error', errorMessage);
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Network Connection Test</Text>
      <Text style={styles.url}>Testing: {API_BASE_URL}/events/public</Text>
      
      <TouchableOpacity 
        style={[styles.button, testing && styles.buttonDisabled]} 
        onPress={testConnection}
        disabled={testing}
      >
        <Text style={styles.buttonText}>
          {testing ? 'Testing...' : 'Test Connection'}
        </Text>
      </TouchableOpacity>

      {result ? (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  url: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#FF4B6E',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultContainer: {
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
  },
  resultText: {
    fontSize: 14,
  },
});
