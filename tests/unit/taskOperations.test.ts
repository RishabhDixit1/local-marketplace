import { describe, expect, it } from "vitest";
import { formatAgo, mapOrderToTask, mapTaskEventToFeedItem, resolveOrderListing } from "../../lib/taskOperations";

describe("task operations helpers", () => {
  it("maps a live order into a task card with profile and listing context", () => {
    const task = mapOrderToTask({
      order: {
        id: "order-1",
        listing_id: "service-1",
        listing_type: "service",
        status: "accepted",
        price: 1499,
        consumer_id: "user-1",
        provider_id: "user-2",
        created_at: "2026-03-08T10:00:00.000Z",
      },
      currentUserId: "user-1",
      profileMap: new Map([
        [
          "user-1",
          {
            id: "user-1",
            name: "Customer One",
            avatar_url: "https://example.com/customer.png",
            location: "Indiranagar",
          },
        ],
        [
          "user-2",
          {
            id: "user-2",
            name: "Spark Clean Team",
            avatar_url: "https://example.com/provider.png",
            location: "HSR Layout",
          },
        ],
      ]),
      serviceMap: new Map([
        [
          "service-1",
          {
            id: "service-1",
            title: "Deep Cleaning",
            description: "Full-home cleaning session.",
            category: "Cleaning",
          },
        ],
      ]),
      productMap: new Map(),
      postMap: new Map(),
    });

    expect(task.type).toBe("posted");
    expect(task.title).toBe("Deep Cleaning");
    expect(task.status).toBe("in-progress");
    expect(task.timeline).toBe("In progress");
    expect(task.postedBy.name).toBe("Customer One");
    expect(task.assignedTo?.name).toBe("Spark Clean Team");
    expect(task.location).toBe("HSR Layout");
    expect(task.tags).toEqual(["Cleaning", "Service", "In Progress"]);
    expect(task.amount).toBe(1499);
  });

  it("formats relative time consistently for minutes, hours, and days", () => {
    const now = new Date("2026-03-08T12:00:00.000Z").getTime();

    expect(formatAgo("2026-03-08T11:35:00.000Z", now)).toBe("25m ago");
    expect(formatAgo("2026-03-08T09:00:00.000Z", now)).toBe("3h ago");
    expect(formatAgo("2026-03-05T12:00:00.000Z", now)).toBe("3d ago");
  });

  it("maps task activity events into a feed item with fallback task labels", () => {
    const feedItem = mapTaskEventToFeedItem({
      event: {
        id: "event-1",
        order_id: "order-99",
        consumer_id: "user-1",
        provider_id: "user-2",
        actor_id: "user-2",
        event_type: "status_changed",
        title: "Task completed",
        description: "Provider marked the work as completed.",
        previous_status: "in_progress",
        next_status: "completed",
        metadata: null,
        created_at: "2026-03-08T11:50:00.000Z",
      },
      taskTitleByOrderId: new Map(),
    });

    expect(feedItem.taskTitle).toBe("Order #order-99");
    expect(feedItem.statusLabel).toBe("Completed");
    expect(feedItem.tone).toBe("emerald");
    expect(feedItem.eventType).toBe("status_changed");
  });

  it("resolves legacy order rows without listing_type into generic live orders", () => {
    const listing = resolveOrderListing({
      id: "legacy-order-1",
      status: "new_lead",
      price: 500,
      consumer_id: "user-1",
      provider_id: "user-2",
      created_at: "2026-03-08T11:50:00.000Z",
      metadata: null,
    });

    expect(listing).toEqual({
      listingId: null,
      listingType: "order",
    });
  });

  it("falls back to order metadata when a demand order comes from a help request", () => {
    const task = mapOrderToTask({
      order: {
        id: "order-help-1",
        listing_type: "demand",
        help_request_id: "help-1",
        status: "quoted",
        price: 3200,
        consumer_id: "user-1",
        provider_id: "user-2",
        created_at: "2026-03-08T12:00:00.000Z",
        metadata: {
          task_title: "Office network setup",
          task_description: "Router setup, cable tidy, and device onboarding.",
          location_label: "Koramangala",
          request_category: "IT Support",
        },
      },
      currentUserId: "user-2",
      profileMap: new Map([
        [
          "user-1",
          {
            id: "user-1",
            name: "Customer One",
            avatar_url: null,
            location: "HSR Layout",
          },
        ],
        [
          "user-2",
          {
            id: "user-2",
            name: "Provider Two",
            avatar_url: null,
            location: "Indiranagar",
          },
        ],
      ]),
      serviceMap: new Map(),
      productMap: new Map(),
      postMap: new Map(),
    });

    expect(task.title).toBe("Office network setup");
    expect(task.description).toContain("Router setup");
    expect(task.location).toBe("Koramangala");
    expect(task.tags).toEqual(["IT Support", "Demand", "Open"]);
  });
});
