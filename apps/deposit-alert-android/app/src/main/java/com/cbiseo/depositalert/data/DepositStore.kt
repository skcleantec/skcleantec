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

@Entity(tableName = "pending_deposits")
data class PendingDeposit(
    @PrimaryKey val dedupeKey: String,
    val sender: String,
    val text: String,
    val receivedAt: String,
    val amountLabel: String,
    val depositorName: String,
    val createdAt: Long,
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

@Database(entities = [PendingDeposit::class, SentDeposit::class], version = 1, exportSchema = false)
abstract class DepositDatabase : RoomDatabase() {
    abstract fun pending(): PendingDao
    abstract fun sent(): SentDao

    companion object {
        @Volatile private var instance: DepositDatabase? = null

        fun get(context: Context): DepositDatabase {
            return instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    DepositDatabase::class.java,
                    "deposit-alert.db",
                ).build().also { instance = it }
            }
        }
    }
}
