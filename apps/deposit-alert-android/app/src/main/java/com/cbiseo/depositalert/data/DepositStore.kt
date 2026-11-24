package com.cbiseo.depositalert.data

import android.content.Context
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Entity(tableName = "pending_deposits")
data class PendingDeposit(
    @PrimaryKey val dedupeKey: String,
    val sender: String,
    val text: String,
    val receivedAt: String,
    val amountLabel: String,
    val depositorName: String,
    val createdAt: Long,
    val contentHash: String = "",
    val source: String = "sms",
)

@Entity(tableName = "sent_deposits")
data class SentDeposit(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val dedupeKey: String,
    val receivedAt: String,
    val amountLabel: String,
    val depositorName: String,
    val resultLabel: String,
    val createdAt: Long,
)

@Dao
interface PendingDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(row: PendingDeposit): Long

    @Query("SELECT * FROM pending_deposits ORDER BY createdAt ASC LIMIT :limit")
    suspend fun next(limit: Int): List<PendingDeposit>

    @Query("SELECT COUNT(*) FROM pending_deposits")
    suspend fun count(): Int

    @Query("DELETE FROM pending_deposits WHERE dedupeKey IN (:keys)")
    suspend fun deleteKeys(keys: List<String>)

    @Query("DELETE FROM pending_deposits WHERE createdAt < :before")
    suspend fun deleteOlderThan(before: Long)

    @Query("DELETE FROM pending_deposits")
    suspend fun clear()
}

@Dao
interface SentDao {
    @Insert
    suspend fun insert(row: SentDeposit)

    @Query("SELECT * FROM sent_deposits ORDER BY createdAt DESC LIMIT 20")
    suspend fun recent(): List<SentDeposit>

    @Query("DELETE FROM sent_deposits WHERE id NOT IN (SELECT id FROM sent_deposits ORDER BY createdAt DESC LIMIT 50)")
    suspend fun prune()
}

@Database(entities = [PendingDeposit::class, SentDeposit::class], version = 2, exportSchema = false)
abstract class DepositDatabase : RoomDatabase() {
    abstract fun pending(): PendingDao
    abstract fun sent(): SentDao

    companion object {
        @Volatile private var instance: DepositDatabase? = null

        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE pending_deposits ADD COLUMN contentHash TEXT NOT NULL DEFAULT ''")
                db.execSQL("ALTER TABLE pending_deposits ADD COLUMN source TEXT NOT NULL DEFAULT 'sms'")
            }
        }

        fun get(context: Context): DepositDatabase {
            return instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    DepositDatabase::class.java,
                    "deposit-alert.db",
                ).addMigrations(MIGRATION_1_2).build().also { instance = it }
            }
        }
    }
}
