import { Capacitor } from '@capacitor/core';
export const platform={isApp:Capacitor.isNativePlatform(),name:Capacitor.getPlatform()};
export async function initializeAppShell(){if(!platform.isApp)return;const[{App},{StatusBar,Style}]=await Promise.all([import('@capacitor/app'),import('@capacitor/status-bar')]);await StatusBar.setStyle({style:Style.Dark});App.addListener('appStateChange',({isActive})=>window.dispatchEvent(new CustomEvent('native-app-state',{detail:{isActive}})));}
