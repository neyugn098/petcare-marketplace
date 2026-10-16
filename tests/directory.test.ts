import { test } from "node:test";
import assert from "node:assert/strict";
import { directoryLocations, pendingDirectoryLocations, nearbyLocations } from "../app/directory-locations";
import { distanceKm } from "../app/location";
test("directory listings have sourced pins, no partner verification or booking rights", () => {
  assert.equal(directoryLocations.length, 9);
  assert.equal(pendingDirectoryLocations.length, 0);
  assert.equal(new Set(directoryLocations.map(p => p.id)).size, 9);
  for (const p of directoryLocations) {
    assert.ok(p.latitude > 10.7 && p.latitude < 11 && p.longitude > 106.7 && p.longitude < 106.9);
    assert.ok(p.directory_source?.startsWith("https://"));
    assert.equal(p.verified, 0); assert.equal(p.accepting_appointments, 0);
  }
  assert.equal(nearbyLocations([], "shop").length, 3);
  assert.equal(nearbyLocations([], "vet").length, 6);
  assert.equal(nearbyLocations([{ ...directoryLocations[0], id: "private", directory_source: undefined }], "shop").some(p => p.id === "private"), false);
  const nearest = nearbyLocations([], "shop").sort((a,b) => distanceKm([10.8397145,106.7663118],[a.latitude,a.longitude])-distanceKm([10.8397145,106.7663118],[b.latitude,b.longitude]));
  assert.equal(nearest[0].id, "directory-xom-meo-xoai");
});
