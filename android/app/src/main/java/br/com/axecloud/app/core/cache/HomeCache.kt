package br.com.axecloud.app.core.cache

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import br.com.axecloud.app.feature.home.HomeSnapshot
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.serialization.json.Json
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import javax.inject.Inject
import javax.inject.Singleton

@Entity(tableName = "home_cache")
data class HomeCacheEntity(@PrimaryKey val accountKey: String, val encryptedPayload: String, val updatedAt: Long)

@Dao
interface HomeCacheDao {
    @Query("SELECT * FROM home_cache WHERE accountKey = :key LIMIT 1") suspend fun get(key: String): HomeCacheEntity?
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun put(value: HomeCacheEntity)
    @Query("DELETE FROM home_cache WHERE updatedAt < :minimum") suspend fun purgeOlderThan(minimum: Long)
}

@Database(entities = [HomeCacheEntity::class], version = 1, exportSchema = false)
abstract class AxeCloudCacheDatabase : RoomDatabase() { abstract fun home(): HomeCacheDao }

@Singleton
class HomeCache @Inject constructor(@ApplicationContext context: Context) {
    private val dao = database(context).home()
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val cipher = CacheCipher()

    suspend fun save(key: String, value: HomeSnapshot) {
        dao.put(HomeCacheEntity(key, cipher.encrypt(json.encodeToString(HomeSnapshot.serializer(), value)), System.currentTimeMillis()))
        dao.purgeOlderThan(System.currentTimeMillis() - 30L * 24 * 60 * 60 * 1000)
    }

    suspend fun read(key: String): HomeSnapshot? = dao.get(key)?.let { row ->
        runCatching { json.decodeFromString(HomeSnapshot.serializer(), cipher.decrypt(row.encryptedPayload)) }.getOrNull()
    }

    private companion object {
        @Volatile private var instance: AxeCloudCacheDatabase? = null
        fun database(context: Context) = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(context, AxeCloudCacheDatabase::class.java, "axecloud-private-cache.db").build().also { instance = it }
        }
    }
}

private class CacheCipher {
    private val alias = "axecloud_offline_cache_v1"
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").run {
            init(KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build())
            generateKey()
        }
    }
    fun encrypt(value: String): String {
        val operation = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        return Base64.encodeToString(operation.iv + operation.doFinal(value.toByteArray()), Base64.NO_WRAP)
    }
    fun decrypt(value: String): String {
        val bytes = Base64.decode(value, Base64.NO_WRAP)
        val iv = bytes.copyOfRange(0, 12)
        val operation = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, iv)) }
        return operation.doFinal(bytes.copyOfRange(12, bytes.size)).toString(Charsets.UTF_8)
    }
}
