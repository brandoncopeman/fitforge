import { Ionicons } from "@expo/vector-icons"
import { useAuth } from "@clerk/clerk-expo"
import * as Haptics from "expo-haptics"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { SafeAreaView } from "react-native-safe-area-context"

import FitCard from "@/components/FitCard"
import StatTile from "@/components/StatTile"
import { colors, radius, spacing } from "@/constants/fitforgeTheme"
import {
  createMobileFoodEntry,
  deleteMobileFoodEntry,
  getMobileFoodEntries,
  getMobileProfile,
  getMobileRecentFoods,
  saveMobileRecentFood,
  searchMobileFoods,
  updateMobileFoodEntry,
} from "@/lib/api"
import {
  MealType,
  MobileFoodEntry,
  MobileFoodEntryPayload,
  MobileFoodSearchResult,
  MobileRecentFood,
} from "@/types/food"

const MEALS: {
  key: MealType
  label: string
  icon: keyof typeof Ionicons.glyphMap
}[] = [
  { key: "breakfast", label: "Breakfast", icon: "sunny-outline" },
  { key: "lunch", label: "Lunch", icon: "restaurant-outline" },
  { key: "dinner", label: "Dinner", icon: "moon-outline" },
  { key: "snack", label: "Snack", icon: "cafe-outline" },
]

type FoodFormState = {
  id?: string
  food_name: string
  meal_type: MealType
  serving_grams: string
  calories: string
  protein_g: string
  carbs_g: string
  fat_g: string
}

type SearchResultLike = MobileFoodSearchResult & {
  name?: string
  food_name?: string
  brand?: string | null
  calories?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  calories_100g?: number
  protein_100g?: number
  carbs_100g?: number
  fat_100g?: number
}

function triggerLightHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
  }
}

function triggerMediumHaptic() {
  if (Platform.OS !== "web") {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {})
  }
}

function makeTempId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")

  return `${year}-${month}-${day}`
}

function shiftDate(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`)
  date.setDate(date.getDate() + days)
  return getLocalDateString(date)
}

function formatDateTitle(dateString: string) {
  const today = getLocalDateString()
  const yesterday = shiftDate(today, -1)
  const tomorrow = shiftDate(today, 1)

  if (dateString === today) return "Today"
  if (dateString === yesterday) return "Yesterday"
  if (dateString === tomorrow) return "Tomorrow"

  const date = new Date(`${dateString}T12:00:00`)
  if (Number.isNaN(date.getTime())) return dateString

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

function toNumber(value: unknown, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeDecimalInput(value: string) {
  const cleaned = value.replace(",", ".").replace(/[^0-9.]/g, "")
  const firstDotIndex = cleaned.indexOf(".")

  if (firstDotIndex === -1) {
    return cleaned
  }

  return (
    cleaned.slice(0, firstDotIndex + 1) +
    cleaned.slice(firstDotIndex + 1).replace(/\./g, "")
  )
}

function roundMacro(value: number) {
  return Math.round(value * 10) / 10
}

function formatMacro(value: unknown, suffix = "g") {
  const number = toNumber(value, 0)
  return `${roundMacro(number)}${suffix}`
}

function formatCalories(value: unknown) {
  return `${Math.round(toNumber(value, 0)).toLocaleString()}`
}

function getSearchName(result: SearchResultLike) {
  return result.name || result.food_name || "Food"
}

function getSearchCalories(result: SearchResultLike) {
  return toNumber(result.calories ?? result.calories_100g, 0)
}

function getSearchProtein(result: SearchResultLike) {
  return toNumber(result.protein_g ?? result.protein_100g, 0)
}

function getSearchCarbs(result: SearchResultLike) {
  return toNumber(result.carbs_g ?? result.carbs_100g, 0)
}

function getSearchFat(result: SearchResultLike) {
  return toNumber(result.fat_g ?? result.fat_100g, 0)
}

function emptyForm(meal: MealType = "snack"): FoodFormState {
  return {
    food_name: "",
    meal_type: meal,
    serving_grams: "",
    calories: "",
    protein_g: "",
    carbs_g: "",
    fat_g: "",
  }
}

function entryToForm(entry: MobileFoodEntry): FoodFormState {
  return {
    id: entry.id,
    food_name: entry.food_name,
    meal_type: entry.meal_type,
    serving_grams:
      entry.serving_grams === null || entry.serving_grams === undefined
        ? ""
        : String(entry.serving_grams),
    calories: String(entry.calories ?? ""),
    protein_g: String(entry.protein_g ?? ""),
    carbs_g: String(entry.carbs_g ?? ""),
    fat_g: String(entry.fat_g ?? ""),
  }
}

function recentToForm(food: MobileRecentFood, meal: MealType): FoodFormState {
  return {
    food_name: food.food_name,
    meal_type: meal,
    serving_grams:
      food.serving_grams === null || food.serving_grams === undefined
        ? ""
        : String(food.serving_grams),
    calories: String(food.calories ?? ""),
    protein_g: String(food.protein_g ?? ""),
    carbs_g: String(food.carbs_g ?? ""),
    fat_g: String(food.fat_g ?? ""),
  }
}

function formToPayload(
  form: FoodFormState,
  date: string
): MobileFoodEntryPayload {
  return {
    food_name: form.food_name.trim() || "Food",
    calories: Math.max(0, toNumber(form.calories, 0)),
    protein_g: Math.max(0, toNumber(form.protein_g, 0)),
    carbs_g: Math.max(0, toNumber(form.carbs_g, 0)),
    fat_g: Math.max(0, toNumber(form.fat_g, 0)),
    meal_type: form.meal_type,
    serving_grams:
      form.serving_grams.trim() === ""
        ? null
        : Math.max(0, toNumber(form.serving_grams, 0)),
    log_date: date,
  }
}

export default function FoodScreen() {
  const { getToken } = useAuth()

  const [selectedDate, setSelectedDate] = useState(getLocalDateString())
  const [entries, setEntries] = useState<MobileFoodEntry[]>([])
  const [recentFoods, setRecentFoods] = useState<MobileRecentFood[]>([])
  const [calorieTarget, setCalorieTarget] = useState(0)
  const [proteinTarget, setProteinTarget] = useState(0)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FoodFormState>(() => emptyForm("snack"))

  const [foodSearchResults, setFoodSearchResults] = useState<
    SearchResultLike[]
  >([])
  const [searchingFoods, setSearchingFoods] = useState(false)

  const latestEntriesRef = useRef<MobileFoodEntry[]>([])
  const foodSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    latestEntriesRef.current = entries
  }, [entries])

  useEffect(() => {
    return () => {
      if (foodSearchTimerRef.current) {
        clearTimeout(foodSearchTimerRef.current)
        foodSearchTimerRef.current = null
      }
    }
  }, [])

  const totals = useMemo(() => {
    return entries.reduce(
      (sum, entry) => ({
        calories: sum.calories + toNumber(entry.calories, 0),
        protein: sum.protein + toNumber(entry.protein_g, 0),
        carbs: sum.carbs + toNumber(entry.carbs_g, 0),
        fat: sum.fat + toNumber(entry.fat_g, 0),
      }),
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
      }
    )
  }, [entries])

  const entriesByMeal = useMemo(() => {
    return MEALS.reduce<Record<MealType, MobileFoodEntry[]>>(
      (map, meal) => {
        map[meal.key] = entries.filter((entry) => entry.meal_type === meal.key)
        return map
      },
      {
        breakfast: [],
        lunch: [],
        dinner: [],
        snack: [],
      }
    )
  }, [entries])

  const loadFoodData = useCallback(
    async (date = selectedDate, isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true)
        } else {
          setLoading(entries.length === 0)
        }

        setError(null)

        const [profileResponse, foodEntries, recent] = await Promise.all([
          getMobileProfile(getToken),
          getMobileFoodEntries(getToken, date),
          getMobileRecentFoods(getToken),
        ])

        setEntries(Array.isArray(foodEntries) ? foodEntries : [])
        setRecentFoods(Array.isArray(recent) ? recent : [])

        setCalorieTarget(
          toNumber(profileResponse.profile?.daily_calorie_target, 0)
        )
        setProteinTarget(
          toNumber(profileResponse.profile?.daily_protein_target, 0)
        )
      } catch (err) {
        console.warn("Failed to load food data", err)
        setError(err instanceof Error ? err.message : "Failed to load food")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [entries.length, getToken, selectedDate]
  )

  useEffect(() => {
    loadFoodData(selectedDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  function changeDate(days: number) {
    triggerLightHaptic()
    setSelectedDate((current) => shiftDate(current, days))
  }

  function openAddFood(meal: MealType = "snack") {
    triggerMediumHaptic()
    setForm(emptyForm(meal))
    setFoodSearchResults([])
    setSearchingFoods(false)
    setShowForm(true)
  }

  function openEditFood(entry: MobileFoodEntry) {
    triggerLightHaptic()
    setForm(entryToForm(entry))
    setFoodSearchResults([])
    setSearchingFoods(false)
    setShowForm(true)
  }

  function openRecentFood(food: MobileRecentFood) {
    triggerLightHaptic()
    setForm(recentToForm(food, "snack"))
    setFoodSearchResults([])
    setSearchingFoods(false)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setSaving(false)
    setFoodSearchResults([])
    setSearchingFoods(false)

    if (foodSearchTimerRef.current) {
      clearTimeout(foodSearchTimerRef.current)
      foodSearchTimerRef.current = null
    }
  }

  function searchFoodsForName(value: string) {
    if (foodSearchTimerRef.current) {
      clearTimeout(foodSearchTimerRef.current)
      foodSearchTimerRef.current = null
    }

    const query = value.trim()

    if (query.length < 2) {
      setFoodSearchResults([])
      setSearchingFoods(false)
      return
    }

    setSearchingFoods(true)

    foodSearchTimerRef.current = setTimeout(() => {
      foodSearchTimerRef.current = null

      searchMobileFoods(getToken, query)
        .then((results) => {
          setFoodSearchResults(Array.isArray(results) ? results : [])
        })
        .catch((err: unknown) => {
          console.warn("Failed to search foods", err)
          setFoodSearchResults([])
        })
        .finally(() => {
          setSearchingFoods(false)
        })
    }, 350)
  }

  function updateFoodName(value: string) {
    setForm((current) => ({
      ...current,
      food_name: value,
    }))

    searchFoodsForName(value)
  }

  function selectFoodSearchResult(result: SearchResultLike) {
    triggerLightHaptic()

    setForm((current) => ({
      ...current,
      food_name: getSearchName(result),
      serving_grams: "100",
      calories: String(Math.round(getSearchCalories(result))),
      protein_g: String(roundMacro(getSearchProtein(result))),
      carbs_g: String(roundMacro(getSearchCarbs(result))),
      fat_g: String(roundMacro(getSearchFat(result))),
    }))

    setFoodSearchResults([])
    setSearchingFoods(false)

    if (foodSearchTimerRef.current) {
      clearTimeout(foodSearchTimerRef.current)
      foodSearchTimerRef.current = null
    }
  }

  function updateFormField(field: keyof FoodFormState, value: string) {
    setForm((current) => ({
      ...current,
      [field]:
        field === "food_name" || field === "meal_type"
          ? value
          : normalizeDecimalInput(value),
    }))
  }

  function updateMealType(meal: MealType) {
    setForm((current) => ({
      ...current,
      meal_type: meal,
    }))
  }

  async function saveFood() {
    if (saving) return

    const payload = formToPayload(form, selectedDate)

    if (!payload.food_name.trim()) {
      setError("Food name is required.")
      return
    }

    triggerMediumHaptic()
    setSaving(true)
    setError(null)

    if (form.id) {
      const previousEntries = latestEntriesRef.current

      const optimisticEntry: MobileFoodEntry = {
        ...(entries.find((entry) => entry.id === form.id) ?? {
          id: form.id,
          log_date: selectedDate,
        }),
        ...payload,
      }

      setEntries((current) =>
        current.map((entry) => (entry.id === form.id ? optimisticEntry : entry))
      )

      closeForm()

      updateMobileFoodEntry(getToken, form.id, {
        food_name: payload.food_name,
        calories: payload.calories,
        protein_g: payload.protein_g,
        carbs_g: payload.carbs_g,
        fat_g: payload.fat_g,
        meal_type: payload.meal_type,
        serving_grams: payload.serving_grams,
      })
        .then((updatedEntry) => {
          setEntries((current) =>
            current.map((entry) =>
              entry.id === form.id ? updatedEntry : entry
            )
          )
        })
        .catch((err: unknown) => {
          console.warn("Failed to update food entry", err)
          setEntries(previousEntries)
          setError(err instanceof Error ? err.message : "Failed to update food")
        })

      return
    }

    const tempId = makeTempId("temp-food")
    const optimisticEntry: MobileFoodEntry = {
      id: tempId,
      ...payload,
      isTemp: true,
    }

    setEntries((current) => [...current, optimisticEntry])
    closeForm()

    createMobileFoodEntry(getToken, payload)
      .then((createdEntry) => {
        setEntries((current) =>
          current.map((entry) => (entry.id === tempId ? createdEntry : entry))
        )

        saveMobileRecentFood(getToken, {
          food_name: payload.food_name,
          calories: payload.calories,
          protein_g: payload.protein_g,
          carbs_g: payload.carbs_g,
          fat_g: payload.fat_g,
          serving_grams: payload.serving_grams,
        })
          .then(() => getMobileRecentFoods(getToken))
          .then((recent) => setRecentFoods(Array.isArray(recent) ? recent : []))
          .catch((err: unknown) => {
            console.warn("Failed to update recent foods", err)
          })
      })
      .catch((err: unknown) => {
        console.warn("Failed to create food entry", err)
        setEntries((current) => current.filter((entry) => entry.id !== tempId))
        setError(err instanceof Error ? err.message : "Failed to log food")
      })
  }

  function confirmDeleteFood(entry: MobileFoodEntry) {
    triggerLightHaptic()

    Alert.alert("Delete food?", `Remove ${entry.food_name} from this day?`, [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteFood(entry),
      },
    ])
  }

  function deleteFood(entry: MobileFoodEntry) {
    const previousEntries = latestEntriesRef.current

    setEntries((current) => current.filter((item) => item.id !== entry.id))

    if (entry.isTemp || entry.id.startsWith("temp")) {
      return
    }

    deleteMobileFoodEntry(getToken, entry.id).catch((err: unknown) => {
      console.warn("Failed to delete food entry", err)
      setEntries(previousEntries)
      setError(err instanceof Error ? err.message : "Failed to delete food")
    })
  }

  const calorieProgress =
    calorieTarget > 0 ? Math.min(1, totals.calories / calorieTarget) : 0

  const proteinProgress =
    proteinTarget > 0 ? Math.min(1, totals.protein / proteinTarget) : 0

  if (loading && entries.length === 0) {
    return (
      <SafeAreaView style={styles.centered} edges={["top"]}>
        <ActivityIndicator color={colors.teal} size="large" />
        <Text style={styles.loadingText}>Loading food...</Text>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadFoodData(selectedDate, true)}
              tintColor={colors.teal}
            />
          }
        >
          <View>
            <Text style={styles.title}>Food</Text>
            <Text style={styles.subtitle}>Calories, protein, and macros</Text>
          </View>

          <FitCard style={styles.dateCard}>
            <Pressable
              onPress={() => changeDate(-1)}
              style={styles.dateButton}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>

            <View style={styles.dateCenter}>
              <Text style={styles.dateTitle}>
                {formatDateTitle(selectedDate)}
              </Text>
              <Text style={styles.dateSubtitle}>{selectedDate}</Text>
            </View>

            <Pressable onPress={() => changeDate(1)} style={styles.dateButton}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </FitCard>

          {error ? (
            <FitCard>
              <Text selectable style={styles.inlineError}>
                {error}
              </Text>
            </FitCard>
          ) : null}

          <FitCard accent>
            <Text style={styles.cardTitle}>Daily Summary</Text>

            <View style={styles.progressBlock}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Calories</Text>
                <Text style={styles.progressValue}>
                  {Math.round(totals.calories).toLocaleString()} /{" "}
                  {calorieTarget > 0 ? calorieTarget.toLocaleString() : "—"}
                </Text>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${calorieProgress * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>

            <View style={styles.progressBlock}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Protein</Text>
                <Text style={styles.progressValue}>
                  {roundMacro(totals.protein)}g /{" "}
                  {proteinTarget > 0 ? `${proteinTarget}g` : "—"}
                </Text>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${proteinProgress * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </FitCard>

          <View style={styles.tileRow}>
            <StatTile
              label="Carbs"
              value={roundMacro(totals.carbs)}
              detail="grams"
            />
            <StatTile
              label="Fat"
              value={roundMacro(totals.fat)}
              detail="grams"
              accent
            />
          </View>

          <Pressable
            onPress={() => openAddFood("snack")}
            style={({ pressed }) => [
              styles.addFoodButton,
              pressed ? styles.pressed : null,
            ]}
          >
            <Ionicons name="add" size={20} color={colors.background} />
            <Text style={styles.addFoodText}>Add Food</Text>
          </Pressable>

          {recentFoods.length > 0 ? (
            <FitCard>
              <Text style={styles.cardTitle}>Recent Foods</Text>
              <Text style={styles.cardText}>
                Tap a recent food to log it again.
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentList}
              >
                {recentFoods.map((food) => (
                  <Pressable
                    key={food.id}
                    onPress={() => openRecentFood(food)}
                    style={({ pressed }) => [
                      styles.recentChip,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <Text style={styles.recentName}>{food.food_name}</Text>
                    <Text style={styles.recentMeta}>
                      {formatCalories(food.calories)} cal ·{" "}
                      {formatMacro(food.protein_g)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </FitCard>
          ) : null}

          {MEALS.map((meal) => (
            <MealSection
              key={meal.key}
              meal={meal}
              entries={entriesByMeal[meal.key]}
              onAdd={() => openAddFood(meal.key)}
              onEdit={openEditFood}
              onDelete={confirmDeleteFood}
            />
          ))}
        </ScrollView>

        <FoodFormModal
          visible={showForm}
          form={form}
          saving={saving}
          searchingFoods={searchingFoods}
          foodSearchResults={foodSearchResults}
          onClose={closeForm}
          onChange={updateFormField}
          onChangeFoodName={updateFoodName}
          onSelectFoodResult={selectFoodSearchResult}
          onChangeMeal={updateMealType}
          onSave={saveFood}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function MealSection({
  meal,
  entries,
  onAdd,
  onEdit,
  onDelete,
}: {
  meal: { key: MealType; label: string; icon: keyof typeof Ionicons.glyphMap }
  entries: MobileFoodEntry[]
  onAdd: () => void
  onEdit: (entry: MobileFoodEntry) => void
  onDelete: (entry: MobileFoodEntry) => void
}) {
  const calories = entries.reduce(
    (sum, entry) => sum + toNumber(entry.calories),
    0
  )

  return (
    <FitCard style={styles.mealCard}>
      <View style={styles.mealHeader}>
        <View style={styles.mealTitleRow}>
          <Ionicons name={meal.icon} size={19} color={colors.teal} />
          <View>
            <Text style={styles.mealTitle}>{meal.label}</Text>
            <Text style={styles.mealSubtitle}>
              {entries.length} item{entries.length === 1 ? "" : "s"} ·{" "}
              {Math.round(calories)} cal
            </Text>
          </View>
        </View>

        <Pressable onPress={onAdd} style={styles.mealAddButton}>
          <Ionicons name="add" size={18} color={colors.teal} />
        </Pressable>
      </View>

      {entries.length > 0 ? (
        <View style={styles.entryList}>
          {entries.map((entry) => (
            <FoodEntryRow
              key={entry.id}
              entry={entry}
              onEdit={() => onEdit(entry)}
              onDelete={() => onDelete(entry)}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyMealText}>No food logged yet.</Text>
      )}
    </FitCard>
  )
}

function FoodEntryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: MobileFoodEntry
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <Pressable onPress={onEdit} style={styles.entryRow}>
      <View style={styles.entryMain}>
        <Text style={styles.entryName}>{entry.food_name}</Text>
        <Text style={styles.entryMeta}>
          {entry.serving_grams ? `${entry.serving_grams}g · ` : ""}
          {formatCalories(entry.calories)} cal · {formatMacro(entry.protein_g)}
        </Text>
      </View>

      <View style={styles.entryActions}>
        <Text style={styles.entryMacro}>
          C {roundMacro(toNumber(entry.carbs_g))} · F{" "}
          {roundMacro(toNumber(entry.fat_g))}
        </Text>

        <Pressable
          onPress={(event) => {
            event.stopPropagation()
            onDelete()
          }}
          style={styles.entryDeleteButton}
        >
          <Ionicons name="close" size={15} color={colors.textMuted} />
        </Pressable>
      </View>
    </Pressable>
  )
}

function FoodFormModal({
  visible,
  form,
  saving,
  searchingFoods,
  foodSearchResults,
  onClose,
  onChange,
  onChangeFoodName,
  onSelectFoodResult,
  onChangeMeal,
  onSave,
}: {
  visible: boolean
  form: FoodFormState
  saving: boolean
  searchingFoods: boolean
  foodSearchResults: SearchResultLike[]
  onClose: () => void
  onChange: (field: keyof FoodFormState, value: string) => void
  onChangeFoodName: (value: string) => void
  onSelectFoodResult: (result: SearchResultLike) => void
  onChangeMeal: (meal: MealType) => void
  onSave: () => void
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {form.id ? "Edit Food" : "Add Food"}
            </Text>

            <Pressable onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <TextInput
              value={form.food_name}
              onChangeText={onChangeFoodName}
              placeholder="Search food or type manually"
              placeholderTextColor={colors.textFaint}
              style={styles.foodNameInput}
            />

            {searchingFoods ? (
              <View style={styles.foodSearchLoading}>
                <ActivityIndicator color={colors.teal} />
                <Text style={styles.foodSearchLoadingText}>
                  Searching foods...
                </Text>
              </View>
            ) : null}

            {foodSearchResults.length > 0 ? (
              <View style={styles.foodSearchResults}>
                {foodSearchResults.map((result, index) => (
                  <Pressable
                    key={`${getSearchName(result)}-${index}`}
                    onPress={() => onSelectFoodResult(result)}
                    style={({ pressed }) => [
                      styles.foodSearchResultRow,
                      pressed ? styles.pressed : null,
                    ]}
                  >
                    <View style={styles.foodSearchResultMain}>
                      <Text style={styles.foodSearchResultName}>
                        {getSearchName(result)}
                      </Text>

                      {result.brand ? (
                        <Text style={styles.foodSearchResultBrand}>
                          {result.brand}
                        </Text>
                      ) : null}

                      <Text style={styles.foodSearchResultMeta}>
                        Per 100g · {Math.round(getSearchCalories(result))} cal ·{" "}
                        {roundMacro(getSearchProtein(result))}g protein
                      </Text>
                    </View>

                    <Ionicons
                      name="add-circle-outline"
                      size={22}
                      color={colors.teal}
                    />
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.mealPicker}>
              {MEALS.map((meal) => (
                <Pressable
                  key={meal.key}
                  onPress={() => onChangeMeal(meal.key)}
                  style={[
                    styles.mealPickerButton,
                    form.meal_type === meal.key
                      ? styles.mealPickerButtonActive
                      : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.mealPickerText,
                      form.meal_type === meal.key
                        ? styles.mealPickerTextActive
                        : null,
                    ]}
                  >
                    {meal.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.formGrid}>
              <MacroInput
                label="Serving"
                value={form.serving_grams}
                suffix="g"
                onChange={(value) => onChange("serving_grams", value)}
              />
              <MacroInput
                label="Calories"
                value={form.calories}
                onChange={(value) => onChange("calories", value)}
              />
              <MacroInput
                label="Protein"
                value={form.protein_g}
                suffix="g"
                onChange={(value) => onChange("protein_g", value)}
              />
              <MacroInput
                label="Carbs"
                value={form.carbs_g}
                suffix="g"
                onChange={(value) => onChange("carbs_g", value)}
              />
              <MacroInput
                label="Fat"
                value={form.fat_g}
                suffix="g"
                onChange={(value) => onChange("fat_g", value)}
              />
            </View>

            <Pressable
              onPress={onSave}
              disabled={saving}
              style={[styles.modalSaveButton, saving && styles.disabledButton]}
            >
              {saving ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.modalSaveText}>
                  {form.id ? "Save Food" : "Log Food"}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function MacroInput({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string
  value: string
  suffix?: string
  onChange: (value: string) => void
}) {
  return (
    <View style={styles.macroInputBox}>
      <Text style={styles.macroInputLabel}>{label}</Text>

      <View style={styles.macroInputRow}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
          selectTextOnFocus
          style={styles.macroInput}
        />
        {suffix ? <Text style={styles.macroInputSuffix}>{suffix}</Text> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  loadingText: {
    color: colors.textMuted,
    fontWeight: "700",
    marginTop: spacing.md,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 130,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  dateCard: {
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  dateButton: {
    height: 42,
    width: 42,
    borderRadius: 21,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  dateCenter: {
    flex: 1,
    alignItems: "center",
  },
  dateTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  dateSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  inlineError: {
    color: colors.red,
    fontSize: 13,
    fontWeight: "700",
  },
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: spacing.sm,
  },
  cardText: {
    color: colors.textSoft,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    marginBottom: spacing.md,
  },
  progressBlock: {
    marginTop: spacing.md,
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  progressValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.surfaceLight,
    overflow: "hidden",
    marginTop: 7,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.teal,
  },
  tileRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  addFoodButton: {
    height: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.teal,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addFoodText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.985 }],
  },
  recentList: {
    gap: spacing.sm,
  },
  recentChip: {
    minWidth: 150,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.md,
  },
  recentName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  recentMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  mealCard: {
    padding: spacing.md,
  },
  mealHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  mealTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  mealTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
  },
  mealSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  mealAddButton: {
    height: 38,
    width: 38,
    borderRadius: 19,
    backgroundColor: colors.tealSoft,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  entryList: {
    gap: spacing.sm,
  },
  entryRow: {
    minHeight: 62,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  entryMain: {
    flex: 1,
  },
  entryName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  entryMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  entryActions: {
    alignItems: "flex-end",
    gap: 6,
  },
  entryMacro: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
  },
  entryDeleteButton: {
    height: 28,
    width: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyMealText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === "android" ? 42 : 64,
    paddingBottom: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 410,
    maxHeight: "90%",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
  },
  modalCloseButton: {
    height: 38,
    width: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  foodNameInput: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    color: colors.text,
    fontSize: 17,
    fontWeight: "900",
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  foodSearchLoading: {
    minHeight: 42,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  foodSearchLoadingText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  foodSearchResults: {
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  foodSearchResultRow: {
    minHeight: 68,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  foodSearchResultMain: {
    flex: 1,
  },
  foodSearchResultName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "capitalize",
  },
  foodSearchResultBrand: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  foodSearchResultMeta: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
  },
  mealPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  mealPickerButton: {
    borderRadius: 999,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  mealPickerButtonActive: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  mealPickerText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
  },
  mealPickerTextActive: {
    color: colors.background,
  },
  formGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  macroInputBox: {
    flexGrow: 1,
    minWidth: "47%",
    minHeight: 62,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceLight,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  macroInputLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  macroInputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  macroInput: {
    flex: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    padding: 0,
  },
  macroInputSuffix: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    marginLeft: 3,
  },
  modalSaveButton: {
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.teal,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  modalSaveText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.55,
  },
})