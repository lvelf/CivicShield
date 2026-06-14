// One DMK instance per process. We default to the Speculos transport (Ledger's official software
// device emulator) so the full human-in-the-loop signing flow can be demoed WITHOUT physical
// hardware. To run against a real device instead, swap in the WebHID (browser) or node-hid (CLI)
// transport — the rest of the signing code is identical.
import { DeviceManagementKitBuilder } from "@ledgerhq/device-management-kit";
import { speculosTransportFactory } from "@ledgerhq/device-transport-kit-speculos";

const SPECULOS_URL = process.env.SPECULOS_URL ?? "http://localhost:5000";

export const dmk = new DeviceManagementKitBuilder()
  .addTransport(speculosTransportFactory(SPECULOS_URL))
  .build();

// For a real Ledger over USB in a CLI, install @ledgerhq/device-transport-kit-node-hid and use:
//   import { nodeHidTransportFactory } from "@ledgerhq/device-transport-kit-node-hid";
//   .addTransport(nodeHidTransportFactory)
// In the browser, use webHidTransportFactory from @ledgerhq/device-transport-kit-web-hid.
