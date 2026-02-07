import { Drawer } from "expo-router/drawer";

export default function _layout() {
  return (
    <Drawer screenOptions={{ headerShown: false }}>
      <Drawer.Screen
        name="(tabs)"
        options={{
          drawerLabel: "Home",
          title: "Admin Side",
        }}
      />
    </Drawer>
  );
}
