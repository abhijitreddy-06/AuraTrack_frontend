import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

let currentIsConnected: boolean | null = null;
let currentIsOnline: boolean | null = null;

export const getNetworkState = async (): Promise<NetInfoState> => {
  const state = await NetInfo.fetch();
  currentIsConnected = state.isConnected ?? false;
  currentIsOnline = state.isInternetReachable ?? state.isConnected ?? false;
  return state;
};

export const isNetworkAvailable = async () => {
  const state = await getNetworkState();
  return Boolean(state.isConnected || state.isInternetReachable);
};

export const subscribeToNetworkChanges = (
  listener: (state: NetInfoState) => void,
) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    currentIsConnected = state.isConnected ?? false;
    currentIsOnline = state.isInternetReachable ?? state.isConnected ?? false;
    listener(state);
  });

  return unsubscribe;
};

export const getCurrentConnectionStatus = () => ({
  isConnected: currentIsConnected ?? false,
  isOnline: currentIsOnline ?? false,
});
