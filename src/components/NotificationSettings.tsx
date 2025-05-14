
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { BellRing, BellOff } from 'lucide-react';

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const NotificationSettings: React.FC = () => {
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false);
  const [notificationTime, setNotificationTime] = useState<string>("09:00");
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | null>(null);
  const [isSubscribing, setIsSubscribing] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission);
      const storedEnabled = localStorage.getItem('roaccuTrackNotificationsEnabled');
      const storedTime = localStorage.getItem('roaccuTrackNotificationTime');
      if (storedEnabled) {
        setNotificationsEnabled(JSON.parse(storedEnabled));
      }
      if (storedTime) {
        setNotificationTime(storedTime);
      }
    }
  }, []);

  const handleEnableChange = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    localStorage.setItem('roaccuTrackNotificationsEnabled', JSON.stringify(enabled));
    if (enabled) {
      requestPermissionAndSubscribe();
    } else {
      unsubscribeFromPush();
      toast({ title: "Notificaciones Desactivadas", description: "Ya no recibirás recordatorios." });
    }
  };

  const handleTimeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setNotificationTime(event.target.value);
    localStorage.setItem('roaccuTrackNotificationTime', event.target.value);
  };

  const requestPermissionAndSubscribe = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      toast({ title: "Error", description: "Las notificaciones push no son compatibles con este navegador.", variant: "destructive" });
      setNotificationsEnabled(false); // Disable if not supported
      return;
    }

    setIsSubscribing(true);
    try {
      const currentPermission = await Notification.requestPermission();
      setPermissionStatus(currentPermission);

      if (currentPermission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
          if (!vapidPublicKey || vapidPublicKey === "YOUR_PUBLIC_VAPID_KEY_HERE") {
            console.error('VAPID public key no configurada.');
            toast({ title: "Error de Configuración", description: "La clave VAPID no está configurada. Contacta al administrador.", variant: "destructive" });
            setIsSubscribing(false);
            setNotificationsEnabled(false); // Disable on configuration error
            return;
          }
          
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          });
        }
        
        console.log('Push subscription:', subscription);
        // TODO: Send subscription to your backend server
        // await fetch('/api/save-subscription', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ subscription, notificationTime }),
        // });

        toast({ title: "Notificaciones Activadas", description: `Recibirás recordatorios a las ${notificationTime}.` });
      } else {
        toast({ title: "Permiso Denegado", description: "No se pudieron activar las notificaciones.", variant: "destructive" });
        setNotificationsEnabled(false);
        localStorage.setItem('roaccuTrackNotificationsEnabled', JSON.stringify(false));
      }
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      toast({ title: "Error", description: "No se pudo suscribir a las notificaciones push.", variant: "destructive" });
      setNotificationsEnabled(false);
      localStorage.setItem('roaccuTrackNotificationsEnabled', JSON.stringify(false));
    } finally {
      setIsSubscribing(false);
    }
  }, [notificationTime, toast]);

  const unsubscribeFromPush = async () => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          console.log('Unsubscribed from push notifications');
          // TODO: Notify backend to remove subscription
          // await fetch('/api/remove-subscription', {
          //   method: 'POST',
          //   headers: { 'Content-Type': 'application/json' },
          //   body: JSON.stringify({ endpoint: subscription.endpoint }),
          // });
        }
      } catch (error) {
        console.error('Error unsubscribing from push notifications:', error);
        toast({ title: "Error", description: "No se pudo desuscribir de las notificaciones.", variant: "destructive" });
      }
    }
  };
  
  const getPermissionButtonText = () => {
    if (permissionStatus === 'granted') return "Permiso Concedido";
    if (permissionStatus === 'denied') return "Permiso Bloqueado";
    return "Permitir Notificaciones";
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold flex items-center">
          <BellRing className="mr-2 h-5 w-5 text-primary" />
          Notificaciones Push
        </CardTitle>
        <CardDescription>Configura recordatorios para tomar tu medicación.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {permissionStatus === 'denied' && (
          <p className="text-sm text-destructive">
            Has bloqueado las notificaciones. Debes habilitarlas en la configuración de tu navegador para usar esta función.
          </p>
        )}
        {typeof window !== 'undefined' && (!('Notification' in window) || !('serviceWorker' in navigator)) && (
            <p className="text-sm text-destructive">
                Las notificaciones push no son compatibles con este navegador o están deshabilitadas.
            </p>
        )}

        <div className="flex items-center justify-between">
          <Label htmlFor="notifications-enabled" className="flex items-center">
            {notificationsEnabled ? <BellRing className="mr-2 h-4 w-4 text-accent" /> : <BellOff className="mr-2 h-4 w-4 text-muted-foreground" />}
            Activar Recordatorios
          </Label>
          <Switch
            id="notifications-enabled"
            checked={notificationsEnabled}
            onCheckedChange={handleEnableChange}
            disabled={permissionStatus === 'denied' || isSubscribing || (typeof window !== 'undefined' && (!('Notification' in window) || !('serviceWorker' in navigator)))}
          />
        </div>
        
        {notificationsEnabled && permissionStatus === 'granted' && (
          <div className="space-y-2">
            <Label htmlFor="notification-time">Hora del Recordatorio</Label>
            <Input
              id="notification-time"
              type="time"
              value={notificationTime}
              onChange={handleTimeChange}
              className="w-full"
              disabled={isSubscribing}
            />
            <Button 
              onClick={() => {
                // TODO: This button might be used to trigger a backend update of the time if subscription already exists
                // For now, it just confirms settings are saved to local storage.
                toast({ title: "Hora Guardada", description: `Los recordatorios se enviarán a las ${notificationTime}. (La lógica de envío real depende del backend)` });
              }}
              className="w-full mt-2"
              disabled={isSubscribing}
            >
              Guardar Hora
            </Button>
          </div>
        )}

        {permissionStatus === 'default' && notificationsEnabled && (
          <Button onClick={requestPermissionAndSubscribe} className="w-full" disabled={isSubscribing}>
            {isSubscribing ? "Procesando..." : getPermissionButtonText()}
          </Button>
        )}

        <p className="text-xs text-muted-foreground pt-2">
          Nota: El envío efectivo de notificaciones push requiere una configuración de servidor backend que no está implementada en esta demo. Esta sección configura las preferencias del lado del cliente y la suscripción.
        </p>
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
