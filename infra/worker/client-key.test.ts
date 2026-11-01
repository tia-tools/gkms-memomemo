import { describe, expect, test } from "bun:test";
import { clientKey, clientNetwork, utcDay } from "./client-key.ts";

describe("utcDay", () => {
  test("is the UTC date, not the local one", () => {
    expect(utcDay(new Date("2026-11-02T23:59:59.999Z"))).toBe("2026-11-02");
    expect(utcDay(new Date("2026-11-03T08:30:00+09:00"))).toBe("2026-11-02");
    expect(utcDay(new Date("2026-11-03T00:00:00Z"))).toBe("2026-11-03");
  });

  test("is the UTC date in any time zone, also where the local date is the next day", () => {
    const zone = process.env.TZ;
    try {
      process.env.TZ = "Asia/Tokyo";
      expect(new Date("2026-11-02T23:59:59Z").getDate()).toBe(3);
      expect(utcDay(new Date("2026-11-02T23:59:59Z"))).toBe("2026-11-02");
    } finally {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    }
  });
});

describe("clientNetwork", () => {
  test("an IPv4 address is itself", () => {
    expect(clientNetwork("203.0.113.7")).toBe("203.0.113.7");
  });

  test("an IPv6 address is its /64, however it is written", () => {
    const full = clientNetwork("2001:0db8:0001:0002:0003:0004:0005:0006");
    expect(full).toBe("2001:db8:1:2::/64");
    expect(clientNetwork("2001:db8:1:2::1")).toBe(full);
    expect(clientNetwork("2001:DB8:1:2:ffff:ffff:ffff:ffff")).toBe(full);
    expect(clientNetwork("2001:db8:1:2:3::")).toBe(full);
    expect(clientNetwork("2001:db8:1:3::1")).toBe("2001:db8:1:3::/64");
    expect(clientNetwork("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(clientNetwork("::1")).toBe("0:0:0:0::/64");
    expect(clientNetwork("::")).toBe("0:0:0:0::/64");
  });

  test("an IPv4-mapped IPv6 address is its IPv4 address, not the one /64 every such address shares", () => {
    expect(clientNetwork("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(clientNetwork("::ffff:cb00:7107")).toBe("203.0.113.7");
    expect(clientNetwork("0:0:0:0:0:ffff:203.0.113.8")).toBe("203.0.113.8");
  });

  test("anything that is not an address is taken as it is", () => {
    for (const odd of ["1::2::3", "2001:db8:1:2:3:4:5", "2001:db8:1:2:3:4:5:6:7", "2001:db8::1:2:3:4:5:6:7", "2001:db8:1:2::3:4:5:6", "fe80::1%eth0", "2001:db8::12345", "::ffff:203.0.113.256", "1.2.3.4::", "x:y"]) {
      expect(clientNetwork(odd)).toBe(odd);
    }
  });
});

describe("clientKey", () => {
  test("is 16 hex digits, stable within a day, and differs across days, salts and networks", async () => {
    const a = await clientKey("203.0.113.7", "2026-11-02", "s");
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(await clientKey("203.0.113.7", "2026-11-02", "s")).toBe(a);
    const others = [
      await clientKey("203.0.113.7", "2026-11-03", "s"),
      await clientKey("203.0.113.7", "2026-11-02", "t"),
      await clientKey("203.0.113.8", "2026-11-02", "s"),
    ];
    for (const other of others) expect(other).not.toBe(a);
  });

  test("two addresses of one IPv6 /64 share a key; another /64 does not", async () => {
    const a = await clientKey("2001:db8:1:2::1", "2026-11-02", "s");
    expect(await clientKey("2001:db8:1:2:abcd::9", "2026-11-02", "s")).toBe(a);
    expect(await clientKey("2001:db8:1:3::1", "2026-11-02", "s")).not.toBe(a);
  });
});
