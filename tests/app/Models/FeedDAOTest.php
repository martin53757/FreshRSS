<?php
declare(strict_types=1);

final class FeedDAOTest extends \PHPUnit\Framework\TestCase {
	public static function test_ttl_min(): void {
		$feed = new FreshRSS_Feed('https://example.net/', false);
		$feed->_ttl(-5);
		self::assertSame(-5, $feed->ttl(true));
		self::assertTrue($feed->mute());
	}

    public function testReorderFeeds(): void {
        $categoryDAO = FreshRSS_Factory::createCategoryDao();
        $feedDAO = FreshRSS_Factory::createFeedDao();

        // 1. Setup: Create a new test category
        $catId = $categoryDAO->addCategory(['name' => 'Sorting Test Category']);
        $this->assertGreaterThan(0, $catId, 'Category should be successfully created.');

        // 2. Setup: Create three new feeds in this category
        $feedId1 = $feedDAO->addFeed(['url' => 'http://example.com/1', 'name' => 'Feed A', 'category' => $catId]);
        $feedId2 = $feedDAO->addFeed(['url' => 'http://example.com/2', 'name' => 'Feed B', 'category' => $catId]);
        $feedId3 = $feedDAO->addFeed(['url' => 'http://example.com/3', 'name' => 'Feed C', 'category' => $catId]);

        $this->assertGreaterThan(0, $feedId1);
        $this->assertGreaterThan(0, $feedId2);
        $this->assertGreaterThan(0, $feedId3);

        // 3. Action: Define the desired new order (e.g., Feed 3, then 1, then 2)
        // Note: The exact method signature (e.g., updateFeedOrder) depends on your implementation.
        $newOrder = [$feedId3, $feedId1, $feedId2];
        $success = $feedDAO->updateFeedOrder($catId, $newOrder);
        
        $this->assertTrue($success, 'Updating the feed order should return true.');

        // 4. Assert: Load feeds from the DB and check if the order matches
        $feeds = $feedDAO->listByCategory($catId);
        
        // Extract the IDs in the order they are returned by the DB
        $fetchedOrder = array_keys($feeds);

        $this->assertEquals(
            $newOrder, 
            $fetchedOrder, 
            'Feeds loaded from the database should match the new order.'
        );
    }
}
